import { extractSlowQueryAttr, TREND_BUCKETS, type QueryPattern } from '../query-patterns'
import type { ProfileSample } from './types'

export type BuildPatternsResult = {
  patterns: QueryPattern[]
  /** Docs aligned with `pattern.sampleRow` (slowest sample per pattern). */
  samples: Record<string, unknown>[]
  windowStartMs: number
  windowEndMs: number
  slowQueryCount: number
}

type MutablePattern = {
  namespace: string
  op: string
  shape: string
  count: number
  totalDurationMs: number
  totalDocsExamined: number
  totalDocsReturned: number
  planCounts: Map<string, number>
  sampleIndex: number
  sampleDurationMs: number
  trend: Uint16Array
}

/** Aggregate profile samples into QueryPatterns (`sampleRow` → `samples` index). */
export function buildPatternsFromSamples(samples: ProfileSample[]): BuildPatternsResult {
  const usable: ProfileSample[] = []
  let windowStartMs = Number.POSITIVE_INFINITY
  let windowEndMs = Number.NEGATIVE_INFINITY

  for (const sample of samples) {
    const extracted = extractSlowQueryAttr(sample.attr)
    if (extracted == null) {
      continue
    }
    usable.push(sample)
    if (Number.isFinite(sample.timestampMs)) {
      if (sample.timestampMs < windowStartMs) {
        windowStartMs = sample.timestampMs
      }
      if (sample.timestampMs > windowEndMs) {
        windowEndMs = sample.timestampMs
      }
    }
  }

  if (usable.length === 0 || !Number.isFinite(windowStartMs)) {
    return {
      patterns: [],
      samples: [],
      windowStartMs: 0,
      windowEndMs: 0,
      slowQueryCount: 0,
    }
  }

  if (windowEndMs < windowStartMs) {
    windowEndMs = windowStartMs
  }

  const span = Math.max(1, windowEndMs - windowStartMs)
  const patterns = new Map<string, MutablePattern>()
  const rawSamples: Record<string, unknown>[] = []

  for (const sample of usable) {
    const extracted = extractSlowQueryAttr(sample.attr)
    if (extracted == null) {
      continue
    }

    const sampleIndex = rawSamples.length
    rawSamples.push(sample.doc)

    const key = `${extracted.namespace}\0${extracted.op}\0${extracted.shape}`
    let mutable = patterns.get(key)
    if (mutable == null) {
      mutable = {
        namespace: extracted.namespace,
        op: extracted.op,
        shape: extracted.shape,
        count: 0,
        totalDurationMs: 0,
        totalDocsExamined: 0,
        totalDocsReturned: 0,
        planCounts: new Map(),
        sampleIndex,
        sampleDurationMs: extracted.durationMs,
        trend: new Uint16Array(TREND_BUCKETS),
      }
      patterns.set(key, mutable)
    }

    mutable.count++
    mutable.totalDurationMs += extracted.durationMs
    mutable.totalDocsExamined += extracted.docsExamined
    mutable.totalDocsReturned += extracted.docsReturned
    mutable.planCounts.set(extracted.plan, (mutable.planCounts.get(extracted.plan) ?? 0) + 1)

    if (extracted.durationMs > mutable.sampleDurationMs) {
      mutable.sampleDurationMs = extracted.durationMs
      mutable.sampleIndex = sampleIndex
    }

    if (Number.isFinite(sample.timestampMs)) {
      const bucket = Math.min(
        TREND_BUCKETS - 1,
        Math.floor(((sample.timestampMs - windowStartMs) / span) * TREND_BUCKETS),
      )
      const next = (mutable.trend[bucket] ?? 0) + 1
      mutable.trend[bucket] = Math.min(0xffff, next)
    }
  }

  const finalized: QueryPattern[] = []
  for (const mutable of patterns.values()) {
    const count = mutable.count
    finalized.push({
      id: 0,
      namespace: mutable.namespace,
      op: mutable.op,
      shape: mutable.shape,
      count,
      avgMs: count > 0 ? Math.round(mutable.totalDurationMs / count) : 0,
      avgDocsExamined: count > 0 ? Math.round(mutable.totalDocsExamined / count) : 0,
      avgDocsReturned: count > 0 ? Math.round(mutable.totalDocsReturned / count) : 0,
      plan: modalPlan(mutable.planCounts),
      trend: mutable.trend,
      sampleRow: mutable.sampleIndex,
      totalDurationMs: mutable.totalDurationMs,
    })
  }

  finalized.sort(function comparePatterns(a, b) {
    if (b.count !== a.count) {
      return b.count - a.count
    }
    return b.avgMs - a.avgMs
  })

  for (let i = 0; i < finalized.length; i++) {
    finalized[i]!.id = i
  }

  return {
    patterns: finalized,
    samples: rawSamples,
    windowStartMs,
    windowEndMs,
    slowQueryCount: usable.length,
  }
}

function modalPlan(counts: Map<string, number>): string {
  let best = 'n/a'
  let bestCount = -1
  for (const [plan, n] of counts) {
    if (n > bestCount) {
      best = plan
      bestCount = n
    }
  }
  return best
}
