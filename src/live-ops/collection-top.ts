import type { CollectionTopRow, TopSample } from './types'

export const MICROSECONDS_PER_MILLISECOND = 1000

export type CollectionTopScale = {
  maxTotalMs: number
  rows: Array<
    CollectionTopRow & {
      fillPercent: number
      readSharePercent: number
    }
  >
}

export type BuildCollectionTopResult = {
  rows: CollectionTopRow[]
  sample: TopSample
  isBaseline: boolean
}

export function microsToMs(micros: number): number {
  return micros / MICROSECONDS_PER_MILLISECOND
}

export function formatTopTimeLabel(totalMs: number): string {
  const total = Math.max(0, totalMs)
  if (total < 1) {
    return '0ms'
  }
  if (total < 1000) {
    return `${Math.round(total)}ms`
  }
  return `${(total / 1000).toFixed(1)}s`
}

export function parseTopCommandResult(result: unknown): TopSample {
  const byNamespace: TopSample['byNamespace'] = {}
  if (result == null || typeof result !== 'object') {
    return { byNamespace }
  }
  const totals = (result as { totals?: unknown }).totals
  if (totals == null || typeof totals !== 'object') {
    return { byNamespace }
  }

  for (const [namespace, entry] of Object.entries(totals as Record<string, unknown>)) {
    if (namespace === 'note' || entry == null || typeof entry !== 'object') {
      continue
    }
    const record = entry as {
      readLock?: { time?: unknown }
      writeLock?: { time?: unknown }
    }
    const readLockMicros = toNonNegativeNumber(record.readLock?.time)
    const writeLockMicros = toNonNegativeNumber(record.writeLock?.time)
    byNamespace[namespace] = { readLockMicros, writeLockMicros }
  }

  return { byNamespace }
}

export function buildCollectionTopRows(
  previous: TopSample | null,
  current: TopSample,
): BuildCollectionTopResult {
  if (previous == null) {
    return {
      rows: [],
      sample: current,
      isBaseline: true,
    }
  }

  const namespaces = new Set([
    ...Object.keys(previous.byNamespace),
    ...Object.keys(current.byNamespace),
  ])

  const rows: CollectionTopRow[] = []
  for (const namespace of namespaces) {
    if (namespace === 'note') {
      continue
    }
    const prev = previous.byNamespace[namespace] ?? {
      readLockMicros: 0,
      writeLockMicros: 0,
    }
    const next = current.byNamespace[namespace] ?? {
      readLockMicros: 0,
      writeLockMicros: 0,
    }
    const readDeltaMicros = Math.max(0, next.readLockMicros - prev.readLockMicros)
    const writeDeltaMicros = Math.max(0, next.writeLockMicros - prev.writeLockMicros)
    const readMs = microsToMs(readDeltaMicros)
    const writeMs = microsToMs(writeDeltaMicros)
    const totalMs = readMs + writeMs
    if (totalMs <= 0) {
      continue
    }
    rows.push({ namespace, readMs, writeMs, totalMs })
  }

  rows.sort(function compareByTotalDesc(a, b) {
    return b.totalMs - a.totalMs
  })

  return {
    rows,
    sample: current,
    isBaseline: false,
  }
}

export function computeCollectionTopScale(rows: readonly CollectionTopRow[]): CollectionTopScale {
  if (rows.length === 0) {
    return { maxTotalMs: 0, rows: [] }
  }

  let maxTotalMs = 0
  for (const row of rows) {
    if (row.totalMs > maxTotalMs) {
      maxTotalMs = row.totalMs
    }
  }

  const scaledRows = rows.map(function scaleRow(row) {
    const fillPercent = maxTotalMs > 0 ? (row.totalMs / maxTotalMs) * 100 : 0
    const readSharePercent = row.totalMs > 0 ? (row.readMs / row.totalMs) * 100 : 0
    return {
      ...row,
      fillPercent,
      readSharePercent,
    }
  })

  return { maxTotalMs, rows: scaledRows }
}

function toNonNegativeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value)
  }
  if (typeof value === 'bigint') {
    return Math.max(0, Number(value))
  }
  if (value != null && typeof value === 'object' && 'toNumber' in value) {
    const maybe = (value as { toNumber: () => number }).toNumber()
    if (typeof maybe === 'number' && Number.isFinite(maybe)) {
      return Math.max(0, maybe)
    }
  }
  return 0
}
