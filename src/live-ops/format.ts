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

const BAR_CHARS = '█'

/**
 * Build a fixed-width mongotop-style bar string (read portion then write portion).
 * Returns the full bar and the split index (read width) for coloring in the UI.
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
  const writeWidth = Math.min(safeWidth - readWidth, Math.round((Math.max(0, writeMs) / total) * safeWidth))
  const used = readWidth + writeWidth
  return {
    readWidth,
    writeWidth,
    emptyWidth: Math.max(0, safeWidth - used),
  }
}

export function repeatBar(width: number): string {
  if (width <= 0) {
    return ''
  }
  return BAR_CHARS.repeat(width)
}

export function formatTopTimeLabel(readMs: number, writeMs: number): string {
  const total = Math.max(0, readMs) + Math.max(0, writeMs)
  if (total < 1) {
    return '0ms'
  }
  if (total < 1000) {
    return `${Math.round(total)}ms`
  }
  return `${(total / 1000).toFixed(1)}s`
}
