import { open } from 'node:fs/promises'
import { isRecord } from '../lib/is-record'
import type { LogStore } from '../parser'
import { extractSlowQueryAttr } from './attr'
import { SLOW_QUERY_ID, TREND_BUCKETS, type QueryPattern, type QueryPatternStore } from './types'

const YIELD_EVERY = 256

type MutablePattern = {
  namespace: string
  op: string
  shape: string
  count: number
  totalDurationMs: number
  totalDocsExamined: number
  totalDocsReturned: number
  planCounts: Map<string, number>
  sampleRow: number
  sampleDurationMs: number
  trend: Uint16Array
}

export async function buildQueryPatternStore(store: LogStore): Promise<QueryPatternStore> {
  const startedAt = performance.now()

  const slowRows: number[] = []
  let windowStartMs = Number.POSITIVE_INFINITY
  let windowEndMs = Number.NEGATIVE_INFINITY

  for (let row = 0; row < store.rowCount; row++) {
    if (store.ids[row] !== SLOW_QUERY_ID) continue
    slowRows.push(row)
    const ts = store.timestamps[row]!
    if (Number.isFinite(ts)) {
      if (ts < windowStartMs) windowStartMs = ts
      if (ts > windowEndMs) windowEndMs = ts
    }
  }

  if (slowRows.length === 0 || !Number.isFinite(windowStartMs)) {
    return {
      patterns: [],
      windowStartMs: 0,
      windowEndMs: 0,
      slowQueryCount: 0,
      buildDurationMs: Math.round(performance.now() - startedAt),
    }
  }

  if (windowEndMs < windowStartMs) {
    windowEndMs = windowStartMs
  }

  const span = Math.max(1, windowEndMs - windowStartMs)
  const patterns = new Map<string, MutablePattern>()
  let processed = 0

  // mem:// paths are used in unit tests without a real file — skip disk reads
  const isMemory = store.path.startsWith('mem://')

  const fh = isMemory ? null : await open(store.path, 'r')
  try {
    for (const row of slowRows) {
      const attr = await readAttrAt(store, row, fh)
      if (attr == null) {
        processed++
        if (processed % YIELD_EVERY === 0) await yieldEventLoop()
        continue
      }

      const extracted = extractSlowQueryAttr(attr)
      if (extracted == null) {
        processed++
        if (processed % YIELD_EVERY === 0) await yieldEventLoop()
        continue
      }

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
          sampleRow: row,
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
        mutable.sampleRow = row
      }

      const ts = store.timestamps[row]!
      if (Number.isFinite(ts)) {
        const bucket = Math.min(
          TREND_BUCKETS - 1,
          Math.floor(((ts - windowStartMs) / span) * TREND_BUCKETS),
        )
        const next = (mutable.trend[bucket] ?? 0) + 1
        mutable.trend[bucket] = Math.min(0xffff, next)
      }

      processed++
      if (processed % YIELD_EVERY === 0) await yieldEventLoop()
    }
  } finally {
    await fh?.close()
  }

  const finalized: QueryPattern[] = []
  let id = 0
  for (const mutable of patterns.values()) {
    const count = mutable.count
    finalized.push({
      id: id++,
      namespace: mutable.namespace,
      op: mutable.op,
      shape: mutable.shape,
      count,
      avgMs: count > 0 ? Math.round(mutable.totalDurationMs / count) : 0,
      avgDocsExamined: count > 0 ? Math.round(mutable.totalDocsExamined / count) : 0,
      avgDocsReturned: count > 0 ? Math.round(mutable.totalDocsReturned / count) : 0,
      plan: modalPlan(mutable.planCounts),
      trend: mutable.trend,
      sampleRow: mutable.sampleRow,
      totalDurationMs: mutable.totalDurationMs,
    })
  }

  finalized.sort(function comparePatterns(a, b) {
    if (b.count !== a.count) return b.count - a.count
    return b.avgMs - a.avgMs
  })

  // Reassign dense ids after sort so table index === id
  for (let i = 0; i < finalized.length; i++) {
    finalized[i]!.id = i
  }

  return {
    patterns: finalized,
    windowStartMs,
    windowEndMs,
    slowQueryCount: slowRows.length,
    buildDurationMs: Math.round(performance.now() - startedAt),
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

/** Let the event loop run (TUI / timers) between attr-read batches. */
async function yieldEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
}

type FileHandle = Awaited<ReturnType<typeof open>>

/**
 * Re-read one indexed line and return its `attr` (or null).
 * Indexing stores only hot fields; slow-query metrics live in the JSON body,
 * so we `JSON.parse` the line again for rows already filtered to id 51803.
 */
async function readAttrAt(
  store: LogStore,
  row: number,
  fh: FileHandle | null,
): Promise<unknown | null> {
  if (fh == null) {
    // In-memory test stores lack a real file backing; use a temp file in tests.
    return null
  }

  const offset = store.offsets[row]!
  const length = store.lengths[row]!
  const buf = Buffer.allocUnsafe(length)
  const { bytesRead } = await fh.read(buf, 0, length, offset)
  const text = buf.subarray(0, bytesRead).toString('utf8')

  try {
    const parsed: unknown = JSON.parse(text)
    if (!isRecord(parsed) || !('attr' in parsed)) {
      return null
    }
    return parsed.attr ?? null
  } catch {
    return null
  }
}
