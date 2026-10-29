import { isRecord } from './is-record'

/**
 * Parse MongoDB structured-log `t` (ISO string or `{ $date }`) to epoch ms.
 * Returns null when missing or unparseable.
 */
export function parseMongoLogTimestampMs(t: unknown): number | null {
  if (t == null) {
    return null
  }
  if (typeof t === 'string') {
    const ms = Date.parse(t)
    return Number.isFinite(ms) ? ms : null
  }
  if (isRecord(t) && '$date' in t) {
    const raw = t.$date
    if (typeof raw === 'string' || typeof raw === 'number') {
      const ms = new Date(raw).getTime()
      return Number.isFinite(ms) ? ms : null
    }
  }
  return null
}
