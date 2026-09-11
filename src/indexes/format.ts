import type { IndexOptionFlag } from './types'

export function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) {
    return '—'
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`
  }
  const units = ['KiB', 'MiB', 'GiB', 'TiB'] as const
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const digits = value >= 10 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

export function formatOps(ops: number | null): string {
  if (ops == null || !Number.isFinite(ops) || ops < 0) {
    return '—'
  }
  return Math.round(ops).toLocaleString('en-US')
}

export function formatSince(since: Date | null, nowMs = Date.now()): string {
  if (since == null || Number.isNaN(since.getTime())) {
    return '—'
  }
  const elapsedMs = Math.max(0, nowMs - since.getTime())
  const seconds = Math.floor(elapsedMs / 1000)
  if (seconds < 60) {
    return `${seconds}s ago`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 48) {
    return `${hours}h ago`
  }
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function formatIndexFlags(flags: IndexOptionFlag[]): string {
  if (flags.length === 0) {
    return '—'
  }
  return flags.join(',')
}

export function truncateIndexCell(value: string, maxLen: number): string {
  if (value.length <= maxLen) {
    return value
  }
  if (maxLen <= 1) {
    return '…'
  }
  return `${value.slice(0, maxLen - 1)}…`
}

/** Compact `{ a: 1, b: -1 }` → `a:1,b:-1`. */
export function formatIndexKey(key: unknown): string {
  if (key == null || typeof key !== 'object' || Array.isArray(key)) {
    return '—'
  }
  const entries = Object.entries(key as Record<string, unknown>)
  if (entries.length === 0) {
    return '—'
  }
  return entries
    .map(function formatEntry([field, value]) {
      return `${field}:${String(value)}`
    })
    .join(',')
}
