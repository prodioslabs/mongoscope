import { parseTailLogLineFromText } from './parse-tail-line'
import type { LogLineRingBuffer } from './ring-buffer'

const TEXT_DECODER = new TextDecoder('utf-8')
const CHAR_LF = 0x0a
const CHAR_CR = 0x0d

/**
 * Live-tail ingest: same carry/newline contract as {@link scanBuffer}, but
 * appends into a ring instead of an unbounded LogStore. Never flushes a
 * trailing partial line — callers retain `carry` across polls.
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
    const text = TEXT_DECODER.decode(buf.subarray(lineStart, lineEnd))
    ring.push(parseTailLogLineFromText(text))
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
