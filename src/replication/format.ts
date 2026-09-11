export function formatLagSeconds(lagSeconds: number | null): string {
  if (lagSeconds == null || !Number.isFinite(lagSeconds) || lagSeconds < 0) {
    return '—'
  }
  const total = Math.round(lagSeconds)
  if (total < 60) {
    return `${total}s`
  }
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m ${seconds}s`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—'
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`
  }
  const units = ['KiB', 'MiB', 'GiB', 'TiB'] as const
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const digits = value >= 10 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

export function formatWindowHours(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours) || hours < 0) {
    return '—'
  }
  return `${hours.toFixed(1)}h`
}

export function formatGrowthRate(bytesPerHour: number | null): string {
  if (bytesPerHour == null || !Number.isFinite(bytesPerHour) || bytesPerHour < 0) {
    return '—'
  }
  return `${formatBytes(bytesPerHour)}/h`
}

/**
 * Prefer hostname without port for DNS-like hosts; keep port for bare IPs.
 */
export function formatMemberLabel(hostPort: string): string {
  const trimmed = hostPort.trim()
  if (trimmed === '') {
    return '—'
  }
  const lastColon = trimmed.lastIndexOf(':')
  if (lastColon <= 0) {
    return trimmed
  }
  const host = trimmed.slice(0, lastColon)
  // IPv4 — keep host:port for clarity.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return trimmed
  }
  // IPv6 in brackets — keep as-is.
  if (host.startsWith('[')) {
    return trimmed
  }
  return host
}

export function formatPriorityVotes(priority: number | null, votes: number | null): string {
  const p = priority == null ? '—' : String(priority)
  const v = votes == null ? '—' : String(votes)
  return `${p} / ${v}`
}
