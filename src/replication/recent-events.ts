import { isRecord } from '../lib/is-record'
import type { RecentReplicationEvent } from './types'

const REPLICATION_COMPONENTS = new Set(['REPL', 'ELECTION', 'REPL_HB', 'INITSYNC', 'ROLLBACK'])

/** Max events kept for the Recent panel (RAM ring is already ≤1024 total). */
const RECENT_EVENTS_LIMIT = 12

/**
 * Parse getLog:'global' output into recent replication-related events.
 * Retention is whatever the server RAM ring still holds — never promise a time window.
 */
export function normalizeRecentReplicationEvents(
  getLogRaw: unknown,
  limit: number = RECENT_EVENTS_LIMIT,
): RecentReplicationEvent[] {
  const lines = extractLogLines(getLogRaw)
  const events: RecentReplicationEvent[] = []

  for (let i = lines.length - 1; i >= 0; i--) {
    const parsed = parseLogLine(lines[i]!)
    if (parsed == null) {
      continue
    }
    events.push(parsed)
    if (events.length >= limit) {
      break
    }
  }

  return events
}

function extractLogLines(getLogRaw: unknown): string[] {
  if (!isRecord(getLogRaw)) {
    return []
  }
  const log = getLogRaw.log
  if (!Array.isArray(log)) {
    return []
  }
  const lines: string[] = []
  for (const entry of log) {
    if (typeof entry === 'string') {
      lines.push(entry)
    }
  }
  return lines
}

function parseLogLine(line: string): RecentReplicationEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (!isRecord(parsed)) {
    return null
  }
  const doc = parsed

  const component = typeof doc.c === 'string' ? doc.c.toUpperCase() : ''
  if (!REPLICATION_COMPONENTS.has(component)) {
    return null
  }

  const message = buildMessage(doc)
  if (message === '') {
    return null
  }

  const timestampMs = parseLogTimestampMs(doc.t)
  return {
    timestampMs,
    timestampLabel: formatEventTimestamp(timestampMs),
    message,
    component,
  }
}

function buildMessage(doc: Record<string, unknown>): string {
  const msg = typeof doc.msg === 'string' ? doc.msg.trim() : ''
  if (msg !== '') {
    return msg
  }
  // Fallback for older lines that bury text in attr.
  if (isRecord(doc.attr)) {
    const attrMsg = doc.attr.msg
    if (typeof attrMsg === 'string' && attrMsg.trim() !== '') {
      return attrMsg.trim()
    }
  }
  return ''
}

function parseLogTimestampMs(t: unknown): number | null {
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

function formatEventTimestamp(ms: number | null): string {
  if (ms == null) {
    return '—'
  }
  const d = new Date(ms)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}
