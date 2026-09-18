export const LIVE_OP_WARNING_MS = 100
export const LIVE_OP_ERROR_MS = 500

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
  if (value.length <= maxLen) {
    return value
  }
  if (maxLen <= 1) {
    return '…'
  }
  return `${value.slice(0, maxLen - 1)}…`
}

const FULL_BLOCK = '█'
/** Unfilled track cells — space keeps column width without a solid block "box" artifact. */
const TRACK_EMPTY = ' '

/** Partial block glyphs from empty (index 0) through nearly-full (index 8). */
const PARTIAL_BLOCKS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const

/**
 * Build a fixed-width bar string for a single fill percentage (0–100).
 * Uses partial-block Unicode for sub-column resolution within each character cell.
 */
export function partialBarString(
  percent: number,
  trackWidth: number,
  emptyChar: string = TRACK_EMPTY,
): string {
  const safeWidth = Math.max(0, Math.floor(trackWidth))
  if (safeWidth === 0) {
    return ''
  }

  const clampedPercent = Math.max(0, Math.min(100, percent))
  const filled = (clampedPercent / 100) * safeWidth
  const fullBlocks = Math.floor(filled)
  const remainder = filled - fullBlocks
  const partialIndex = Math.round(remainder * 8)
  const partialChar = PARTIAL_BLOCKS[Math.min(8, Math.max(0, partialIndex))] ?? ''
  const emptyCount = safeWidth - fullBlocks - (partialChar === '' ? 0 : 1)

  return FULL_BLOCK.repeat(fullBlocks) + partialChar + emptyChar.repeat(Math.max(0, emptyCount))
}

/** Character fill level for one cell in a proportional segment [0, fillEnd). */
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
 * Build mongotop-style read / write / empty bar strings for collection top.
 * Bar length scales to {@link maxTotalMs} (busiest row in the table); read vs write
 * split is proportional within that filled portion.
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

export type CollectionTopRowScale = {
  rowTotalMs: number
  /** Filled portion of track (read + write) relative to busiest row. */
  fillPercent: number
  /** Read portion of full track width. */
  readPercent: number
  /** Write portion of full track width (within filled portion). */
  writePercent: number
}

/** Scale metrics for one collection-top row (all values in milliseconds). */
export function collectionTopRowScale(
  readMs: number,
  writeMs: number,
  maxTotalMs: number,
  trackWidth: number,
): CollectionTopRowScale {
  const safeWidth = Math.max(0, Math.floor(trackWidth))
  const rowTotalMs = Math.max(0, readMs) + Math.max(0, writeMs)
  if (rowTotalMs <= 0 || maxTotalMs <= 0 || safeWidth === 0) {
    return { rowTotalMs, fillPercent: 0, readPercent: 0, writePercent: 0 }
  }
  const readEnd = (Math.max(0, readMs) / maxTotalMs) * safeWidth
  const writeEnd = (rowTotalMs / maxTotalMs) * safeWidth
  return {
    rowTotalMs,
    fillPercent: (rowTotalMs / maxTotalMs) * 100,
    readPercent: (readEnd / safeWidth) * 100,
    writePercent: ((writeEnd - readEnd) / safeWidth) * 100,
  }
}

/** Combined bar string (read + write + empty); always exactly {@link trackWidth} chars. */
export function collectionTopBarString(
  readMs: number,
  writeMs: number,
  trackWidth: number,
  maxTotalMs: number,
): string {
  const segments = collectionTopBarSegments(readMs, writeMs, trackWidth, maxTotalMs)
  return segments.read + segments.write + segments.empty
}

/** Max read+write ms among collection-top rows (used as bar scale denominator). */
export function maxCollectionTopTotalMs(
  rows: readonly { readMs: number; writeMs: number }[],
): number {
  let max = 0
  for (const row of rows) {
    const total = Math.max(0, row.readMs) + Math.max(0, row.writeMs)
    if (total > max) {
      max = total
    }
  }
  return max
}

/**
 * @deprecated Prefer {@link collectionTopBarSegments} for partial-block rendering.
 * Integer character widths (whole blocks only).
 */
export function collectionTopBarWidths(
  readMs: number,
  writeMs: number,
  width: number,
): { readWidth: number; writeWidth: number; emptyWidth: number } {
  const safeWidth = Math.max(0, Math.floor(width))
  if (safeWidth === 0) {
    return { readWidth: 0, writeWidth: 0, emptyWidth: 0 }
  }
  const total = Math.max(0, readMs) + Math.max(0, writeMs)
  if (total <= 0) {
    return { readWidth: 0, writeWidth: 0, emptyWidth: safeWidth }
  }
  const readWidth = Math.round((Math.max(0, readMs) / total) * safeWidth)
  const writeWidth = Math.min(
    safeWidth - readWidth,
    Math.round((Math.max(0, writeMs) / total) * safeWidth),
  )
  const used = readWidth + writeWidth
  return {
    readWidth,
    writeWidth,
    emptyWidth: Math.max(0, safeWidth - used),
  }
}

/** @deprecated Prefer {@link collectionTopBarSegments} or {@link partialBarString}. */
export function repeatBar(width: number): string {
  if (width <= 0) {
    return ''
  }
  return FULL_BLOCK.repeat(width)
}
