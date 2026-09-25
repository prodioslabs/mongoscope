import { isRecord } from '../lib/is-record'
import type { CollectionTopRow, TopSample } from './types'

const MICROSECONDS_PER_MILLISECOND = 1000

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
  if (!isRecord(result)) {
    return { byNamespace }
  }
  const totals = result.totals
  if (!isRecord(totals)) {
    return { byNamespace }
  }

  for (const [namespace, entry] of Object.entries(totals)) {
    if (namespace === 'note' || !isRecord(entry)) {
      continue
    }
    const readLock = asOptionalRecord(entry.readLock)
    const writeLock = asOptionalRecord(entry.writeLock)
    const readLockMicros = toNonNegativeNumber(readLock?.time)
    const writeLockMicros = toNonNegativeNumber(writeLock?.time)
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

function asOptionalRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function toNonNegativeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value)
  }
  if (typeof value === 'bigint') {
    return Math.max(0, Number(value))
  }
  if (isRecord(value) && typeof value.toNumber === 'function') {
    const maybe = value.toNumber()
    if (typeof maybe === 'number' && Number.isFinite(maybe)) {
      return Math.max(0, maybe)
    }
  }
  return 0
}
