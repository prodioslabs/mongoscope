import type { Severity } from '../../../lib/text-table-content'
import { truncateText } from '../../../../lib/truncate-text'

export type { Severity } from '../../../lib/text-table-content'

const SPARK_CHARS = '▁▂▃▄▅▆▇█'

/** Default sparkline width so the TREND column stays narrow in the table. */
const SPARKLINE_WIDTH = 12

export function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

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
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))}s window`

  const minutes = seconds / 60
  if (minutes < 90) return `${Math.max(1, Math.round(minutes))}m window`

  const hours = minutes / 60
  if (hours < 36) return `${Math.max(1, Math.round(hours))}h window`

  const days = hours / 24
  return `${Math.max(1, Math.round(days))}d window`
}

/** Max-pool a trend series into a fixed-width block sparkline. */
export function sparkline(trend: Uint16Array, width: number = SPARKLINE_WIDTH): string {
  if (trend.length === 0 || width <= 0) return ''

  const pooled = new Uint16Array(width)
  for (let i = 0; i < trend.length; i++) {
    const bucket = Math.min(width - 1, Math.floor((i / trend.length) * width))
    const v = trend[i] ?? 0
    if (v > (pooled[bucket] ?? 0)) pooled[bucket] = v
  }

  let max = 0
  for (let i = 0; i < pooled.length; i++) {
    const v = pooled[i] ?? 0
    if (v > max) max = v
  }
  if (max === 0) return SPARK_CHARS[0]!.repeat(width)

  let out = ''
  const last = SPARK_CHARS.length - 1
  for (let i = 0; i < pooled.length; i++) {
    const v = pooled[i] ?? 0
    const idx = Math.min(last, Math.round((v / max) * last))
    out += SPARK_CHARS[idx]!
  }
  return out
}

export function avgMsSeverity(avgMs: number): Severity {
  if (avgMs >= 500) return 'error'
  if (avgMs >= 100) return 'warning'
  return 'muted'
}

export function examinedSeverity(examined: number, returned: number): Severity {
  const ratio = examined / Math.max(returned, 1)
  if (ratio >= 500) return 'error'
  if (ratio >= 20) return 'warning'
  return 'success'
}

export function planSeverity(plan: string): Severity {
  if (plan === 'COLLSCAN') return 'error'
  if (plan === 'IXSCAN+SORT') return 'warning'
  if (plan === 'IXSCAN') return 'success'
  return 'muted'
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
