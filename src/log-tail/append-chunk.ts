import {
  encodeSeverity,
  scanHotFields,
  severityLabel,
  SEVERITY_RAW,
} from '../parser'
import { extractLogLineAttrFields } from './attr-fields'
import type { LogLineRingBuffer } from './ring-buffer'
import type { TailLogLine } from './types'

const TEXT_DECODER = new TextDecoder('utf-8')
const CHAR_LF = 0x0a
const CHAR_CR = 0x0d

/**
 * Live-tail ingest seam: same carry / newline contract as {@link scanBuffer},
 * but appends {@link TailLogLine} entries into a ring (with optional attr fields)
 * instead of growing an unbounded LogStore.
 *
 * Never flushes a trailing partial line — callers must retain `carry` across polls.
 */
export function appendTailChunk(
  ring: LogLineRingBuffer,
  chunk: Uint8Array,
  fileOffsetOfChunk: number,
  carry: Uint8Array | null,
  carryFileOffset: number,
): { carry: Uint8Array | null; carryFileOffset: number; linesAdded: number } {
  let buf: Uint8Array
  let baseOffset: number
  if (carry && carry.length > 0) {
    buf = new Uint8Array(carry.length + chunk.length)
    buf.set(carry, 0)
    buf.set(chunk, carry.length)
    baseOffset = carryFileOffset
  } else {
    buf = chunk
    baseOffset = fileOffsetOfChunk
  }

  let linesAdded = 0
  let lineStart = 0
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== CHAR_LF) {
      continue
    }

    let lineEnd = i
    if (lineEnd > lineStart && buf[lineEnd - 1] === CHAR_CR) {
      lineEnd--
    }
    ring.push(parseCompleteLine(buf, lineStart, lineEnd))
    linesAdded++
    lineStart = i + 1
  }

  if (lineStart >= buf.length) {
    return {
      carry: null,
      carryFileOffset: baseOffset + buf.length,
      linesAdded,
    }
  }

  const remaining = buf.subarray(lineStart)
  const nextCarry = new Uint8Array(remaining.length)
  nextCarry.set(remaining)
  return {
    carry: nextCarry,
    carryFileOffset: baseOffset + lineStart,
    linesAdded,
  }
}

/**
 * Drop a leading partial line when seeding from a mid-file byte window.
 * Returns bytes starting at the first complete line (or empty if none).
 */
export function skipPartialLeadingLine(buf: Uint8Array): {
  bytes: Uint8Array
  skipped: number
} {
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === CHAR_LF) {
      return { bytes: buf.subarray(i + 1), skipped: i + 1 }
    }
  }
  return { bytes: new Uint8Array(0), skipped: buf.length }
}

function parseCompleteLine(buf: Uint8Array, start: number, end: number): TailLogLine {
  const length = end - start
  if (length === 0) {
    return rawLine('', Number.NaN)
  }

  const hot = scanHotFields(buf, start, end)
  let text: string
  try {
    text = TEXT_DECODER.decode(buf.subarray(start, end))
  } catch {
    return rawLine('[invalid utf-8]', Number.NaN)
  }

  if (hot != null) {
    const attr = tryExtractAttr(text)
    return {
      timestamp: hot.timestamp,
      severity: hot.severity,
      severityLabel: severityLabel(hot.severity),
      component: hot.component,
      id: hot.id,
      ctx: hot.ctx,
      msg: hot.msg,
      namespace: attr.namespace,
      durationMillis: attr.durationMillis,
      planSummary: attr.planSummary,
      kind: 'json',
    }
  }

  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>
      if (typeof obj.s === 'string' && typeof obj.c === 'string' && typeof obj.msg === 'string') {
        const attr = extractLogLineAttrFields(obj.attr)
        const severity = encodeSeverity(obj.s)
        return {
          timestamp: parseTimestampLoose(obj.t),
          severity,
          severityLabel: severityLabel(severity),
          component: obj.c,
          id: typeof obj.id === 'number' ? obj.id >>> 0 : 0,
          ctx: typeof obj.ctx === 'string' ? obj.ctx : '',
          msg: obj.msg,
          namespace: attr.namespace,
          durationMillis: attr.durationMillis,
          planSummary: attr.planSummary,
          kind: 'json',
        }
      }
    }
  } catch {
    // fall through to raw
  }

  return rawLine(text, Number.NaN)
}

function tryExtractAttr(text: string): ReturnType<typeof extractLogLineAttrFields> {
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) && 'attr' in parsed) {
      return extractLogLineAttrFields((parsed as { attr?: unknown }).attr)
    }
  } catch {
    // ignore
  }
  return { namespace: null, durationMillis: null, planSummary: null }
}

function rawLine(text: string, timestamp: number): TailLogLine {
  return {
    timestamp,
    severity: SEVERITY_RAW,
    severityLabel: '',
    component: '',
    id: 0,
    ctx: '',
    msg: text,
    namespace: null,
    durationMillis: null,
    planSummary: null,
    kind: 'raw',
  }
}

function parseTimestampLoose(t: unknown): number {
  if (t == null) {
    return Number.NaN
  }
  if (typeof t === 'string') {
    const ms = Date.parse(t)
    return Number.isNaN(ms) ? Number.NaN : ms
  }
  if (typeof t === 'object' && t !== null && '$date' in t) {
    const raw = (t as { $date: unknown }).$date
    if (typeof raw === 'string' || typeof raw === 'number') {
      const ms = new Date(raw).getTime()
      return Number.isFinite(ms) ? ms : Number.NaN
    }
  }
  return Number.NaN
}
