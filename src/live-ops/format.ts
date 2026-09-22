import { truncateText } from '../lib/truncate-text'

const LIVE_OP_WARNING_MS = 100
const LIVE_OP_ERROR_MS = 500

export type LiveOpSeverity = 'error' | 'warning' | 'normal'

export function runningMsSeverity(runningMs: number): LiveOpSeverity {
  if (runningMs >= LIVE_OP_ERROR_MS) {
    return 'error'
  }
  if (runningMs >= LIVE_OP_WARNING_MS) {
    return 'warning'
  }
  return 'normal'
}

export function formatRunningMs(runningMs: number): string {
  if (!Number.isFinite(runningMs) || runningMs < 0) {
    return '—'
  }
  return Math.round(runningMs).toLocaleString('en-US')
}

export function truncateLiveOpsCell(value: string, maxLen: number): string {
  return truncateText(value, maxLen)
}

const FULL_BLOCK = '█'
/** Space (not a block glyph) so empty track cells do not draw a solid box. */
const TRACK_EMPTY = ' '

/** Partial block glyphs: empty (0) through nearly-full (8). */
const PARTIAL_BLOCKS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const

/** Fill level for one character cell in [0, fillEnd). */
function barCharAt(index: number, fillEnd: number, emptyChar: string): string {
  if (index < 0 || fillEnd <= 0) {
    return emptyChar
  }
  const cellStart = index
  const cellEnd = index + 1
  if (fillEnd <= cellStart) {
    return emptyChar
  }
  if (fillEnd >= cellEnd) {
    return FULL_BLOCK
  }
  const remainder = fillEnd - cellStart
  const partialIndex = Math.round(remainder * 8)
  const partialChar = PARTIAL_BLOCKS[Math.min(8, Math.max(0, partialIndex))] ?? ''
  return partialChar === '' ? emptyChar : partialChar
}

/**
 * Mongotop-style read / write / empty bar segments.
 * Length scales to {@link maxTotalMs}; read vs write split within the filled portion.
 */
export function collectionTopBarSegments(
  readMs: number,
  writeMs: number,
  trackWidth: number,
  maxTotalMs: number,
  emptyChar: string = TRACK_EMPTY,
): { read: string; write: string; empty: string } {
  const safeWidth = Math.max(0, Math.floor(trackWidth))
  if (safeWidth === 0) {
    return { read: '', write: '', empty: '' }
  }

  const rowTotal = Math.max(0, readMs) + Math.max(0, writeMs)
  if (rowTotal <= 0 || maxTotalMs <= 0) {
    return { read: '', write: '', empty: emptyChar.repeat(safeWidth) }
  }

  const readEnd = (Math.max(0, readMs) / maxTotalMs) * safeWidth
  const writeEnd = (rowTotal / maxTotalMs) * safeWidth

  let read = ''
  let write = ''
  let empty = ''

  for (let i = 0; i < safeWidth; i++) {
    if (i >= writeEnd) {
      empty += emptyChar
    } else if (i >= readEnd) {
      write += barCharAt(i - readEnd, writeEnd - readEnd, emptyChar)
    } else {
      read += barCharAt(i, readEnd, emptyChar)
    }
  }

  return { read, write, empty }
}
