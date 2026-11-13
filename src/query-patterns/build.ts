import { open } from 'node:fs/promises'
import { isRecord } from '../lib/is-record'
import type { LogStore } from '../parser'
import { extractSlowQueryAttr } from './attr'
import {
  bucketIndexForTimestamp,
  indexMarkerFromAttr,
  isIndexMarkerCandidateId,
  modalPlanFromCounts,
  planMixFromCounts,
  type IndexMarker,
  type PatternHistory,
} from './time-machine'
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
  sumDurationMs: Float64Array
  sumDocsExamined: Float64Array
  sumDocsReturned: Float64Array
  bucketPlanCounts: Map<string, number>[]
  firstSeenSlowMs: number
  lastSeenSlowMs: number
}

export async function buildQueryPatternStore(store: LogStore): Promise<QueryPatternStore> {
  const startedAt = performance.now()

  const slowRows: number[] = []
  const markerCandidateRows: number[] = []
  let windowStartMs = Number.POSITIVE_INFINITY
  let windowEndMs = Number.NEGATIVE_INFINITY

  for (let row = 0; row < store.rowCount; row++) {
    const id = store.ids[row]!
    if (isIndexMarkerCandidateId(id)) {
      markerCandidateRows.push(row)
    }
    if (id !== SLOW_QUERY_ID) {
      continue
    }
    slowRows.push(row)
    const ts = store.timestamps[row]!
    if (Number.isFinite(ts)) {
      if (ts < windowStartMs) {
        windowStartMs = ts
      }
      if (ts > windowEndMs) {
        windowEndMs = ts
      }
    }
  }

  if (slowRows.length === 0 || !Number.isFinite(windowStartMs)) {
    return {
      patterns: [],
      windowStartMs: 0,
      windowEndMs: 0,
      slowQueryCount: 0,
      buildDurationMs: Math.round(performance.now() - startedAt),
      indexMarkers: [],
    }
  }

  if (windowEndMs < windowStartMs) {
    windowEndMs = windowStartMs
  }

  const patterns = new Map<string, MutablePattern>()
  const indexMarkers: IndexMarker[] = []
  let processed = 0

  // mem:// paths are used in unit tests without a real file — skip disk reads
  const isMemory = store.path.startsWith('mem://')

  const fh = isMemory ? null : await open(store.path, 'r')
  try {
    for (const row of slowRows) {
      const attr = await readAttrAt(store, row, fh)
      if (attr == null) {
        processed++
        if (processed % YIELD_EVERY === 0) {
          await yieldEventLoop()
        }
        continue
      }

      const createMarker = indexMarkerFromAttr(
        {
          row,
          id: store.ids[row]!,
          timestampMs: store.timestamps[row]!,
          msg: store.getEntry(row).msg,
        },
        attr,
      )
      if (createMarker != null && createMarker.kind === 'create-indexes') {
        indexMarkers.push(createMarker)
      }

      const extracted = extractSlowQueryAttr(attr)
      if (extracted == null) {
        processed++
        if (processed % YIELD_EVERY === 0) {
          await yieldEventLoop()
        }
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
          sumDurationMs: new Float64Array(TREND_BUCKETS),
          sumDocsExamined: new Float64Array(TREND_BUCKETS),
          sumDocsReturned: new Float64Array(TREND_BUCKETS),
          bucketPlanCounts: Array.from({ length: TREND_BUCKETS }, () => new Map()),
          firstSeenSlowMs: Number.POSITIVE_INFINITY,
          lastSeenSlowMs: Number.NEGATIVE_INFINITY,
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
        if (ts < mutable.firstSeenSlowMs) {
          mutable.firstSeenSlowMs = ts
        }
        if (ts > mutable.lastSeenSlowMs) {
          mutable.lastSeenSlowMs = ts
        }
        const bucket = bucketIndexForTimestamp(ts, windowStartMs, windowEndMs, TREND_BUCKETS)
        if (bucket != null) {
          const next = (mutable.trend[bucket] ?? 0) + 1
          mutable.trend[bucket] = Math.min(0xffff, next)
          mutable.sumDurationMs[bucket] =
            (mutable.sumDurationMs[bucket] ?? 0) + extracted.durationMs
          mutable.sumDocsExamined[bucket] =
            (mutable.sumDocsExamined[bucket] ?? 0) + extracted.docsExamined
          mutable.sumDocsReturned[bucket] =
            (mutable.sumDocsReturned[bucket] ?? 0) + extracted.docsReturned
          const bucketPlans = mutable.bucketPlanCounts[bucket]!
          bucketPlans.set(extracted.plan, (bucketPlans.get(extracted.plan) ?? 0) + 1)
        }
      }

      processed++
      if (processed % YIELD_EVERY === 0) {
        await yieldEventLoop()
      }
    }

    // Non-slow index markers (build start/complete, dropIndexes).
    for (const row of markerCandidateRows) {
      const id = store.ids[row]!
      if (id === SLOW_QUERY_ID) {
        continue
      }
      const attr = await readAttrAt(store, row, fh)
      if (attr == null) {
        processed++
        if (processed % YIELD_EVERY === 0) {
          await yieldEventLoop()
        }
        continue
      }
      const marker = indexMarkerFromAttr(
        {
          row,
          id,
          timestampMs: store.timestamps[row]!,
          msg: store.getEntry(row).msg,
        },
        attr,
      )
      if (marker != null) {
        indexMarkers.push(marker)
      }
      processed++
      if (processed % YIELD_EVERY === 0) {
        await yieldEventLoop()
      }
    }
  } finally {
    await fh?.close()
  }

  indexMarkers.sort(function compareMarkers(a, b) {
    return a.timestampMs - b.timestampMs
  })

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
      plan: modalPlanFromCounts(mutable.planCounts),
      trend: mutable.trend,
      sampleRow: mutable.sampleRow,
      totalDurationMs: mutable.totalDurationMs,
      history: finalizeHistory(mutable),
    })
  }

  finalized.sort(function comparePatterns(a, b) {
    if (b.count !== a.count) {
      return b.count - a.count
    }
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
    indexMarkers,
  }
}

function finalizeHistory(mutable: MutablePattern): PatternHistory {
  const firstSeenSlowMs = Number.isFinite(mutable.firstSeenSlowMs) ? mutable.firstSeenSlowMs : 0
  const lastSeenSlowMs = Number.isFinite(mutable.lastSeenSlowMs)
    ? mutable.lastSeenSlowMs
    : firstSeenSlowMs

  const bucketPlans: string[] = []
  for (let i = 0; i < TREND_BUCKETS; i++) {
    const counts = mutable.bucketPlanCounts[i]!
    if (counts.size === 0) {
      bucketPlans.push('')
    } else {
      bucketPlans.push(modalPlanFromCounts(counts))
    }
  }

  return {
    firstSeenSlowMs,
    lastSeenSlowMs,
    sumDurationMs: mutable.sumDurationMs,
    sumDocsExamined: mutable.sumDocsExamined,
    sumDocsReturned: mutable.sumDocsReturned,
    bucketPlans,
    planMix: planMixFromCounts(mutable.planCounts),
  }
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
