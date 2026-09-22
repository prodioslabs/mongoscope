import type { ProfileSample } from './types'

/**
 * Convert a system.profile document into the attr-shaped object that
 * {@link extractSlowQueryAttr} expects (log attr uses durationMillis; profile uses millis).
 * Returns null when the doc should be skipped (noise / missing ns).
 */
export function profileDocToAttr(doc: unknown): Record<string, unknown> | null {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return null
  }
  const record = doc as Record<string, unknown>
  const namespace = typeof record.ns === 'string' ? record.ns : ''
  if (!namespace || namespace.endsWith('.$cmd')) {
    return null
  }

  const attr: Record<string, unknown> = {
    ns: namespace,
  }

  if (record.command !== undefined) {
    attr.command = record.command
  }
  if (typeof record.op === 'string') {
    attr.type = record.op
  }
  if (typeof record.millis === 'number' && Number.isFinite(record.millis)) {
    attr.durationMillis = record.millis
  }
  if (typeof record.planSummary === 'string') {
    attr.planSummary = record.planSummary
  }
  if (record.docsExamined !== undefined) {
    attr.docsExamined = record.docsExamined
  }
  if (record.keysExamined !== undefined) {
    attr.keysExamined = record.keysExamined
  }
  if (record.nreturned !== undefined) {
    attr.nreturned = record.nreturned
  } else if (record.nReturned !== undefined) {
    attr.nReturned = record.nReturned
  }
  if (record.pipeline !== undefined) {
    attr.pipeline = record.pipeline
  }
  if (record.filter !== undefined) {
    attr.filter = record.filter
  }
  if (record.query !== undefined) {
    attr.query = record.query
  }
  if (typeof record.appName === 'string') {
    attr.appName = record.appName
  }
  if (typeof record.client === 'string') {
    attr.remote = record.client
  }
  if (typeof record.protocol === 'string') {
    attr.protocol = record.protocol
  }
  if (record.numYield !== undefined) {
    attr.numYields = record.numYield
  } else if (record.numYields !== undefined) {
    attr.numYields = record.numYields
  }
  if (record.responseLength !== undefined) {
    attr.reslen = record.responseLength
  }
  if (record.execStats !== undefined) {
    attr.execStats = record.execStats
  }

  return attr
}

export function profileDocTimestampMs(doc: unknown): number {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return Number.NaN
  }
  const ts = (doc as Record<string, unknown>).ts
  if (ts instanceof Date) {
    return ts.getTime()
  }
  if (isDateLike(ts)) {
    const value = ts.getTime()
    return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
  }
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return ts
  }
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts)
    return Number.isFinite(parsed) ? parsed : Number.NaN
  }
  return Number.NaN
}

export function toProfileSample(doc: unknown): ProfileSample | null {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    return null
  }
  const record = doc as Record<string, unknown>
  const attr = profileDocToAttr(record)
  if (attr == null) {
    return null
  }
  return {
    doc: record,
    attr,
    timestampMs: profileDocTimestampMs(record),
  }
}

function isDateLike(value: unknown): value is { getTime: () => number } {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as { getTime?: unknown }).getTime === 'function'
  )
}
