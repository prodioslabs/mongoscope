/**
 * Mongod structured-log byte scanner.
 *
 * Indexes files as Uint8Array chunks (newline + carry), extracting only hot
 * fields (t, s, c, id, ctx, msg) into a columnar LogStore. Avoids JSON.parse
 * on the hot path; non-matching lines become kind=raw. `parseLogFile` yields
 * progressive batches so the TUI can render while indexing continues.
 */

import { createReadStream } from 'node:fs'
import { open } from 'node:fs/promises'
import { encodeSeverity, LogStore, type SeverityCode } from './store'

const TEXT_DECODER = new TextDecoder('utf-8')

const PREFIX = '{"t":{"$date":"'
const PREFIX_BYTES = new TextEncoder().encode(PREFIX)

const CHAR_0 = 0x30
const CHAR_9 = 0x39
const CHAR_QUOTE = 0x22
const CHAR_BACKSLASH = 0x5c
const CHAR_COLON = 0x3a
const CHAR_COMMA = 0x2c
const CHAR_T = 0x54
const CHAR_Z = 0x5a
const CHAR_PLUS = 0x2b
const CHAR_MINUS = 0x2d
const CHAR_DOT = 0x2e
const CHAR_SPACE = 0x20
const CHAR_TAB = 0x09
const CHAR_LF = 0x0a
const CHAR_CR = 0x0d
const CHAR_s = 0x73
const CHAR_c = 0x63
const CHAR_i = 0x69
const CHAR_d = 0x64
const CHAR_t = 0x74
const CHAR_x = 0x78
const CHAR_m = 0x6d
const CHAR_g = 0x67

const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function digit(buf: Uint8Array, i: number): number {
  const b = buf[i]!
  if (b < CHAR_0 || b > CHAR_9) return -1
  return b - CHAR_0
}

function parseNDigits(buf: Uint8Array, i: number, n: number): number {
  let v = 0
  for (let k = 0; k < n; k++) {
    const d = digit(buf, i + k)
    if (d < 0) return -1
    v = v * 10 + d
  }
  return v
}

/**
 * Parse ISO-8601 timestamps of the form:
 *   YYYY-MM-DDTHH:mm:ss.sssZ
 *   YYYY-MM-DDTHH:mm:ss.sss±HH:MM
 * Milliseconds may be 1–3 digits. Returns epoch millis or NaN.
 */
export function parseIsoTimestampBytes(buf: Uint8Array, start: number, end: number): number {
  // Minimum: YYYY-MM-DDTHH:mm:ssZ = 20 chars
  if (end - start < 20) return Number.NaN

  const year = parseNDigits(buf, start, 4)
  if (year < 0 || buf[start + 4] !== CHAR_MINUS) return Number.NaN
  const month = parseNDigits(buf, start + 5, 2)
  if (month < 1 || month > 12 || buf[start + 7] !== CHAR_MINUS) return Number.NaN
  const day = parseNDigits(buf, start + 8, 2)
  if (day < 1 || day > 31 || buf[start + 10] !== CHAR_T) return Number.NaN
  const hour = parseNDigits(buf, start + 11, 2)
  if (hour < 0 || hour > 23 || buf[start + 13] !== CHAR_COLON) return Number.NaN
  const minute = parseNDigits(buf, start + 14, 2)
  if (minute < 0 || minute > 59 || buf[start + 16] !== CHAR_COLON) return Number.NaN
  const second = parseNDigits(buf, start + 17, 2)
  if (second < 0 || second > 60) return Number.NaN

  let i = start + 19
  let millis = 0
  if (i < end && buf[i] === CHAR_DOT) {
    i++
    let n = 0
    let value = 0
    while (i < end && n < 3) {
      const d = digit(buf, i)
      if (d < 0) break
      value = value * 10 + d
      n++
      i++
    }
    // Skip extra fractional digits
    while (i < end) {
      const d = digit(buf, i)
      if (d < 0) break
      i++
    }
    if (n === 1) millis = value * 100
    else if (n === 2) millis = value * 10
    else millis = value
  }

  let offsetMinutes = 0
  if (i < end && buf[i] === CHAR_Z) {
    i++
  } else if (i < end && (buf[i] === CHAR_PLUS || buf[i] === CHAR_MINUS)) {
    const sign = buf[i] === CHAR_MINUS ? -1 : 1
    i++
    if (i + 5 > end) return Number.NaN
    const oh = parseNDigits(buf, i, 2)
    if (oh < 0 || buf[i + 2] !== CHAR_COLON) return Number.NaN
    const om = parseNDigits(buf, i + 3, 2)
    if (om < 0 || om > 59) return Number.NaN
    offsetMinutes = sign * (oh * 60 + om)
    i += 5
  } else {
    return Number.NaN
  }

  if (i !== end) return Number.NaN

  // Days since Unix epoch (1970-01-01)
  let days = 0
  for (let y = 1970; y < year; y++) {
    days += isLeapYear(y) ? 366 : 365
  }
  days += DAYS_BEFORE_MONTH[month - 1]!
  if (month > 2 && isLeapYear(year)) days += 1
  days += day - 1

  const totalMinutes = days * 24 * 60 + hour * 60 + minute - offsetMinutes
  return totalMinutes * 60_000 + second * 1000 + millis
}

function skipWs(buf: Uint8Array, i: number, end: number): number {
  while (i < end) {
    const b = buf[i]!
    if (b !== CHAR_SPACE && b !== CHAR_TAB) break
    i++
  }
  return i
}

function expectBytes(buf: Uint8Array, i: number, end: number, expected: number[]): number {
  if (i + expected.length > end) return -1
  for (let k = 0; k < expected.length; k++) {
    if (buf[i + k] !== expected[k]) return -1
  }
  return i + expected.length
}

/** Find closing unescaped double-quote; returns index of quote or -1. */
function findStringEnd(buf: Uint8Array, start: number, end: number): number {
  let i = start
  while (i < end) {
    const b = buf[i]!
    if (b === CHAR_QUOTE) return i
    if (b === CHAR_BACKSLASH) {
      i += 2
      continue
    }
    i++
  }
  return -1
}

function decodeSlice(buf: Uint8Array, start: number, end: number): string {
  return TEXT_DECODER.decode(buf.subarray(start, end))
}

type HotFields = {
  timestamp: number
  severity: SeverityCode
  component: string
  id: number
  ctx: string
  msg: string
}

/**
 * Specialized forward scan for mongod 4.4+ structured JSON log lines.
 * Returns null if the line does not match the expected shape.
 */
export function scanHotFields(buf: Uint8Array, start: number, end: number): HotFields | null {
  let i = start

  // {"t":{"$date":"
  if (i + PREFIX_BYTES.length > end) return null
  for (let k = 0; k < PREFIX_BYTES.length; k++) {
    if (buf[i + k] !== PREFIX_BYTES[k]) return null
  }
  i += PREFIX_BYTES.length

  const tsStart = i
  const tsEnd = findStringEnd(buf, i, end)
  if (tsEnd < 0) return null
  const timestamp = parseIsoTimestampBytes(buf, tsStart, tsEnd)
  if (Number.isNaN(timestamp)) return null
  // Timestamp closing quote already at tsEnd; next bytes are },"s":"
  i = tsEnd + 1
  i = expectBytes(buf, i, end, [0x7d, 0x2c, 0x22, CHAR_s, 0x22, CHAR_COLON, 0x22])
  if (i < 0) return null

  const sevStart = i
  const sevEnd = findStringEnd(buf, i, end)
  if (sevEnd < 0) return null
  const severity = encodeSeverity(decodeSlice(buf, sevStart, sevEnd))
  i = sevEnd + 1

  // ,"c":"  (with optional spaces after comma)
  if (i >= end || buf[i] !== CHAR_COMMA) return null
  i = skipWs(buf, i + 1, end)
  i = expectBytes(buf, i, end, [0x22, CHAR_c, 0x22, CHAR_COLON, 0x22])
  if (i < 0) return null

  const compStart = i
  const compEnd = findStringEnd(buf, i, end)
  if (compEnd < 0) return null
  const component = decodeSlice(buf, compStart, compEnd)
  i = compEnd + 1

  // ,"id":
  if (i >= end || buf[i] !== CHAR_COMMA) return null
  i = skipWs(buf, i + 1, end)
  i = expectBytes(buf, i, end, [0x22, CHAR_i, CHAR_d, 0x22, CHAR_COLON])
  if (i < 0) return null
  i = skipWs(buf, i, end)

  let id = 0
  const idStart = i
  while (i < end) {
    const d = digit(buf, i)
    if (d < 0) break
    id = id * 10 + d
    i++
  }
  if (i === idStart) return null

  // ,"ctx":"
  if (i >= end || buf[i] !== CHAR_COMMA) return null
  i = skipWs(buf, i + 1, end)
  i = expectBytes(buf, i, end, [0x22, CHAR_c, CHAR_t, CHAR_x, 0x22, CHAR_COLON, 0x22])
  if (i < 0) return null

  const ctxStart = i
  const ctxEnd = findStringEnd(buf, i, end)
  if (ctxEnd < 0) return null
  const ctx = decodeSlice(buf, ctxStart, ctxEnd)
  i = ctxEnd + 1

  // ,"msg":"
  if (i >= end || buf[i] !== CHAR_COMMA) return null
  i = skipWs(buf, i + 1, end)
  i = expectBytes(buf, i, end, [0x22, CHAR_m, CHAR_s, CHAR_g, 0x22, CHAR_COLON, 0x22])
  if (i < 0) return null

  const msgStart = i
  const msgEnd = findStringEnd(buf, i, end)
  if (msgEnd < 0) return null
  const msg = decodeSlice(buf, msgStart, msgEnd)

  return { timestamp, severity, component, id, ctx, msg }
}

type MongoDate = { $date?: string }
type MongoLine = {
  t?: MongoDate | string
  s?: string
  c?: string
  id?: number
  ctx?: string
  msg?: string
}

function parseTimestampFromJson(t: MongoLine['t']): number {
  if (t == null) return Number.NaN
  if (typeof t === 'string') {
    const ms = Date.parse(t)
    return Number.isNaN(ms) ? Number.NaN : ms
  }
  if (typeof t === 'object' && typeof t.$date === 'string') {
    const ms = Date.parse(t.$date)
    return Number.isNaN(ms) ? Number.NaN : ms
  }
  return Number.NaN
}

function tryJsonFallback(buf: Uint8Array, start: number, end: number): HotFields | null {
  const text = decodeSlice(buf, start, end)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }
  const obj = parsed as MongoLine
  if (typeof obj.s !== 'string' || typeof obj.c !== 'string') return null
  if (typeof obj.id !== 'number' || typeof obj.ctx !== 'string') return null
  if (typeof obj.msg !== 'string') return null
  const timestamp = parseTimestampFromJson(obj.t)
  if (Number.isNaN(timestamp)) return null
  return {
    timestamp,
    severity: encodeSeverity(obj.s),
    component: obj.c,
    id: obj.id >>> 0,
    ctx: obj.ctx,
    msg: obj.msg,
  }
}

function ingestLine(
  store: LogStore,
  buf: Uint8Array,
  start: number,
  end: number,
  fileOffset: number,
): void {
  const length = end - start
  if (length === 0) {
    // Empty line — treat as raw blank
    store.pushRaw({ offset: fileOffset, length: 0, text: '' })
    return
  }

  // Keep leading BOM / whitespace for indexing fidelity.
  let hot = scanHotFields(buf, start, end)
  if (!hot) {
    hot = tryJsonFallback(buf, start, end)
  }

  if (hot) {
    store.pushJson({
      offset: fileOffset,
      length,
      timestamp: hot.timestamp,
      severity: hot.severity,
      id: hot.id,
      component: hot.component,
      ctx: hot.ctx,
      msg: hot.msg,
    })
  } else {
    store.pushRaw({
      offset: fileOffset,
      length,
      text: decodeSlice(buf, start, end),
    })
  }
}

/**
 * Scan complete lines from a buffer that may include a carry prefix from a
 * previous chunk. Returns the new carry (incomplete trailing line bytes) and
 * the absolute file offset of the first byte of that carry.
 */
export function scanBuffer(
  store: LogStore,
  chunk: Uint8Array,
  fileOffsetOfChunk: number,
  carry: Uint8Array | null,
  carryFileOffset: number,
): { carry: Uint8Array | null; carryFileOffset: number; linesAdded: number } {
  const before = store.rowCount

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

  let lineStart = 0
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] !== CHAR_LF) continue

    let lineEnd = i
    if (lineEnd > lineStart && buf[lineEnd - 1] === CHAR_CR) {
      lineEnd--
    }
    ingestLine(store, buf, lineStart, lineEnd, baseOffset + lineStart)
    lineStart = i + 1
  }

  if (lineStart >= buf.length) {
    return {
      carry: null,
      carryFileOffset: baseOffset + buf.length,
      linesAdded: store.rowCount - before,
    }
  }

  const remaining = buf.subarray(lineStart)
  const nextCarry = new Uint8Array(remaining.length)
  nextCarry.set(remaining)
  return {
    carry: nextCarry,
    carryFileOffset: baseOffset + lineStart,
    linesAdded: store.rowCount - before,
  }
}

/** Flush a trailing carry as the final line (no terminating newline). */
export function flushCarry(
  store: LogStore,
  carry: Uint8Array | null,
  carryFileOffset: number,
): number {
  if (!carry || carry.length === 0) return 0
  let end = carry.length
  if (end > 0 && carry[end - 1] === CHAR_CR) end--
  const before = store.rowCount
  ingestLine(store, carry, 0, end, carryFileOffset)
  return store.rowCount - before
}

type ScanBytesOptions = {
  chunkSize?: number
}

/**
 * Parse an in-memory byte buffer (or pre-split chunks) into `store`.
 * Useful for tests without touching the filesystem.
 */
export function scanBytes(
  store: LogStore,
  input: Uint8Array | Uint8Array[],
  options?: ScanBytesOptions,
): void {
  const chunks = Array.isArray(input)
    ? input
    : splitForTest(input, options?.chunkSize ?? input.length)

  let carry: Uint8Array | null = null
  let carryFileOffset = 0
  let fileOffset = 0

  for (const chunk of chunks) {
    const result = scanBuffer(store, chunk, fileOffset, carry, carryFileOffset)
    carry = result.carry
    carryFileOffset = result.carryFileOffset
    fileOffset += chunk.length
  }

  flushCarry(store, carry, carryFileOffset)
  store.byteLength = fileOffset
}

function splitForTest(buf: Uint8Array, chunkSize: number): Uint8Array[] {
  if (chunkSize <= 0 || chunkSize >= buf.length) return [buf]
  const out: Uint8Array[] = []
  for (let i = 0; i < buf.length; i += chunkSize) {
    out.push(buf.subarray(i, Math.min(i + chunkSize, buf.length)))
  }
  return out
}

export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024
export const DEFAULT_BATCH_SIZE = 50_000

export type ParseBatch = {
  store: LogStore
  start: number
  end: number
}

export type ParseProgress = {
  bytesRead: number
  rowCount: number
}

export type ParseLogFileOptions = {
  batchSize?: number
  chunkSize?: number
  onProgress?: (info: ParseProgress) => void
}

/**
 * Stream a log file in chunks, appending into a shared LogStore and yielding
 * progressive batches for UI rendering.
 */
export async function* parseLogFile(
  path: string,
  options?: ParseLogFileOptions,
): AsyncGenerator<ParseBatch, void, undefined> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE
  const onProgress = options?.onProgress
  const store = new LogStore(path)

  const stream = createReadStream(path, {
    highWaterMark: chunkSize,
  })

  let carry: Uint8Array | null = null
  let carryFileOffset = 0
  let fileOffset = 0
  let batchStart = 0

  try {
    for await (const value of stream) {
      const chunk =
        value instanceof Uint8Array
          ? value
          : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)

      if (chunk.length === 0) continue

      const result = scanBuffer(store, chunk, fileOffset, carry, carryFileOffset)
      carry = result.carry
      carryFileOffset = result.carryFileOffset
      fileOffset += chunk.length
      store.byteLength = fileOffset
      onProgress?.({ bytesRead: fileOffset, rowCount: store.rowCount })

      while (store.rowCount - batchStart >= batchSize) {
        const end = batchStart + batchSize
        yield { store, start: batchStart, end }
        batchStart = end
      }
    }

    flushCarry(store, carry, carryFileOffset)
    store.byteLength = fileOffset
    onProgress?.({ bytesRead: fileOffset, rowCount: store.rowCount })

    if (store.rowCount > batchStart) {
      yield { store, start: batchStart, end: store.rowCount }
    } else if (batchStart === 0 && store.rowCount === 0) {
      // Empty file: still yield once so callers can obtain the store.
      yield { store, start: 0, end: 0 }
    }
  } finally {
    stream.destroy()
  }
}

export async function readLineAt(path: string, offset: number, length: number): Promise<string> {
  const fh = await open(path, 'r')
  try {
    const buf = Buffer.allocUnsafe(length)
    const { bytesRead } = await fh.read(buf, 0, length, offset)
    return buf.subarray(0, bytesRead).toString('utf8')
  } finally {
    await fh.close()
  }
}
