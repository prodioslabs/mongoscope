import type { ExportFormat } from './types'
import { EXPORT_EXTENSIONS } from './types'

/**
 * Timestamped default filename using local wall-clock time.
 * Example: `mongoscope-slow-queries-20261008-160045.json`
 */
export function defaultExportFilename(format: ExportFormat, now: Date = new Date()): string {
  const stamp = formatLocalTimestamp(now)
  return `mongoscope-slow-queries-${stamp}.${EXPORT_EXTENSIONS[format]}`
}

function formatLocalTimestamp(date: Date): string {
  const year = date.getFullYear()
  const month = pad2(date.getMonth() + 1)
  const day = pad2(date.getDate())
  const hour = pad2(date.getHours())
  const minute = pad2(date.getMinutes())
  const second = pad2(date.getSeconds())
  return `${year}${month}${day}-${hour}${minute}${second}`
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}
