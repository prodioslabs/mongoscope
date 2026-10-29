import type { Severity } from '../../../lib/text-table-content'
import { planSeverity } from '../../../lib/text-table-content'
import { formatCount } from '../../../../lib/format-count'
import { sparkline as sparklineFromLib } from '../../../../lib/sparkline'
import { truncateText } from '../../../../lib/truncate-text'

export { formatCount, planSeverity }

export function formatExaminedRet(examined: number, returned: number): string {
  return `${formatCount(examined)} / ${formatCount(returned)}`
}

/** Max characters shown for the SHAPE column before truncating with an ellipsis. */
const CELL_MAX_LEN = 20

export function truncateCell(shape: string, maxLen: number = CELL_MAX_LEN): string {
  return truncateText(shape, maxLen)
}

/**
 * Human-readable pattern window, e.g. `15m window` or `full log`.
 */
export function formatWindowLabel(startMs: number, endMs: number): string {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 'full log'
  }

  const spanMs = endMs - startMs
  const seconds = spanMs / 1000
  if (seconds < 90) {
    return `${Math.max(1, Math.round(seconds))}s window`
  }

  const minutes = seconds / 60
  if (minutes < 90) {
    return `${Math.max(1, Math.round(minutes))}m window`
  }

  const hours = minutes / 60
  if (hours < 36) {
    return `${Math.max(1, Math.round(hours))}h window`
  }

  const days = hours / 24
  return `${Math.max(1, Math.round(days))}d window`
}

export function sparkline(trend: Uint16Array, width?: number): string {
  return sparklineFromLib(trend, width)
}

export function avgMsSeverity(avgMs: number): Severity {
  if (avgMs >= 500) {
    return 'error'
  }
  if (avgMs >= 100) {
    return 'warning'
  }
  return 'muted'
}

export function examinedSeverity(examined: number, returned: number): Severity {
  const ratio = examined / Math.max(returned, 1)
  if (ratio >= 500) {
    return 'error'
  }
  if (ratio >= 20) {
    return 'warning'
  }
  return 'success'
}

/** Lower rank sorts first (worst plans first). */
export function planSortRank(plan: string): number {
  switch (planSeverity(plan)) {
    case 'error':
      return 0
    case 'warning':
      return 1
    case 'success':
      return 2
    case 'muted':
      return 3
  }
}
