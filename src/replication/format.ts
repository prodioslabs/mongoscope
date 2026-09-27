import { formatBytes } from '../lib/format-bytes'
import { horizontalBarString } from '../lib/horizontal-bar-string'

export { formatBytes, horizontalBarString }

export function formatLagSeconds(lagSeconds: number | null): string {
  if (lagSeconds == null || !Number.isFinite(lagSeconds) || lagSeconds < 0) {
    return '—'
  }
  if (lagSeconds < 60) {
    const rounded = Math.round(lagSeconds * 10) / 10
    if (Number.isInteger(rounded)) {
      return `${rounded}s`
    }
    return `${rounded.toFixed(1)}s`
  }
  const total = Math.round(lagSeconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m ${seconds}s`
}

export function formatWindowHours(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours) || hours < 0) {
    return '—'
  }
  return `${hours.toFixed(1)} hrs`
}

export function formatGrowthRate(bytesPerHour: number | null): string {
  if (bytesPerHour == null || !Number.isFinite(bytesPerHour) || bytesPerHour < 0) {
    return '—'
  }
  return `~${formatBytes(bytesPerHour)}/hr`
}

/** Member meta line, e.g. `priority 2 • votes 1`. */
export function formatMemberMeta(priority: number | null, votes: number | null): string {
  const p = priority == null ? '—' : String(priority)
  const v = votes == null ? '—' : String(votes)
  return `priority ${p} • votes ${v}`
}

/** Short label for lag/heartbeat titles — first DNS label or host. */
export function formatShortHost(hostPort: string): string {
  const host = hostPort.includes(':') ? hostPort.slice(0, hostPort.lastIndexOf(':')) : hostPort
  const firstLabel = host.split('.')[0]
  return firstLabel != null && firstLabel !== '' ? firstLabel : host
}

export function formatPingMs(pingMs: number): string {
  if (!Number.isFinite(pingMs) || pingMs < 0) {
    return '—'
  }
  if (pingMs < 10) {
    return `${Math.round(pingMs * 10) / 10}ms`
  }
  return `${Math.round(pingMs)}ms`
}

export function formatHeartbeatEdge(fromName: string, toName: string): string {
  return `${formatShortHost(fromName)} → ${formatShortHost(toName)}`
}

const FULL_BLOCK = '█'
const TRACK_EMPTY = ' '

/**
 * Multi-row vertical bar chart. Each column is one value; returns `height` lines
 * from top to bottom (histogram style for the lag trend panel).
 */
export function verticalBarChartLines(values: readonly number[], height: number): string[] {
  const safeHeight = Math.max(1, Math.floor(height))
  if (values.length === 0) {
    return Array.from({ length: safeHeight }, () => '')
  }

  let max = 0
  for (const value of values) {
    if (value > max) {
      max = value
    }
  }

  const lines: string[] = []
  for (let row = safeHeight - 1; row >= 0; row--) {
    let line = ''
    for (const value of values) {
      if (max <= 0) {
        line += TRACK_EMPTY
        continue
      }
      const filledRows = (Math.max(0, value) / max) * safeHeight
      line += filledRows > row ? FULL_BLOCK : TRACK_EMPTY
    }
    lines.push(line)
  }
  return lines
}
