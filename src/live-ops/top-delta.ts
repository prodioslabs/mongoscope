import type { CollectionTopDelta, TopSample } from './types'

/**
 * Diff two cumulative `top` samples into per-namespace read/write deltas (milliseconds).
 * Negative deltas (counter reset) are treated as 0 for that namespace.
 */
export function computeTopDeltas(
  previous: TopSample | null,
  current: TopSample,
): CollectionTopDelta[] {
  if (previous == null) {
    return []
  }

  const namespaces = new Set([
    ...Object.keys(previous.byNamespace),
    ...Object.keys(current.byNamespace),
  ])

  const deltas: CollectionTopDelta[] = []
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
    const readMs = readDeltaMicros / 1000
    const writeMs = writeDeltaMicros / 1000
    if (readMs <= 0 && writeMs <= 0) {
      continue
    }
    deltas.push({ namespace, readMs, writeMs })
  }

  deltas.sort(function compareByTotalDesc(a, b) {
    return b.readMs + b.writeMs - (a.readMs + a.writeMs)
  })

  return deltas
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
