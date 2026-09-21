/**
 * Extract string log lines from a MongoDB `getLog: 'global'` command result.
 * The server returns at most ~1024 recent events from an in-RAM ring — not a durable file.
 */
export function extractGetLogLines(getLogRaw: unknown): string[] {
  if (getLogRaw == null || typeof getLogRaw !== 'object') {
    return []
  }
  const log = (getLogRaw as { log?: unknown }).log
  if (!Array.isArray(log)) {
    return []
  }
  const lines: string[] = []
  for (const entry of log) {
    if (typeof entry === 'string') {
      lines.push(entry)
    }
  }
  return lines
}
