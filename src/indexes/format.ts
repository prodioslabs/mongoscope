import { formatBytes } from '../lib/format-bytes'
import { formatCount } from '../lib/format-count'
import { isRecord } from '../lib/is-record'
import type { IndexOptionFlag } from './types'

export { formatBytes }

export function formatOps(ops: number | null): string {
  if (ops == null || !Number.isFinite(ops) || ops < 0) {
    return '—'
  }
  return formatCount(ops)
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

export function formatBuildProgress(input: {
  building: boolean
  buildPercent: number | null
}): string {
  if (!input.building) {
    return '—'
  }
  if (input.buildPercent != null && Number.isFinite(input.buildPercent)) {
    const rounded = Math.round(input.buildPercent * 10) / 10
    if (Number.isInteger(rounded)) {
      return `${rounded}%`
    }
    return `${rounded.toFixed(1)}%`
  }
  return 'building'
}

/** Compact `{ a: 1, b: -1 }` → `a:1,b:-1`. */
export function formatIndexKey(key: unknown): string {
  if (!isRecord(key)) {
    return '—'
  }
  const entries = Object.entries(key)
  if (entries.length === 0) {
    return '—'
  }
  return entries
    .map(function formatEntry([field, value]) {
      return `${field}:${String(value)}`
    })
    .join(',')
}
