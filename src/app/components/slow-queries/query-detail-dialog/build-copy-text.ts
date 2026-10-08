import {
  formatCount,
  formatExaminedRet,
  sparkline,
} from '../format'
import type { PatternExplain, QueryPattern } from '../../../../query-patterns'

/** Pretty-print JSON when possible; otherwise return the input unchanged. */
export function prettyDisplay(value: string): string {
  if (value === 'n/a') {
    return value
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

export function formatTimestamp(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) {
    return 'n/a'
  }
  return new Date(timestampMs).toISOString()
}

export function formatCpu(cpuNanos: number): string {
  if (cpuNanos >= 1_000_000) {
    return `${(cpuNanos / 1_000_000).toFixed(1)} ms`
  }
  if (cpuNanos >= 1_000) {
    return `${(cpuNanos / 1_000).toFixed(0)} µs`
  }
  return `${formatCount(cpuNanos)} ns`
}

function pushRow(lines: string[], label: string, value: string): void {
  lines.push(`${label}: ${value}`)
}

/**
 * Plain-text body for the currently displayed query-detail view.
 * Returns null when there is nothing meaningful to copy (still loading / empty).
 */
export function buildQueryDetailCopyText(
  explain: PatternExplain | null,
  pattern: QueryPattern | null,
  showRaw: boolean,
): string | null {
  if (explain == null || pattern == null) {
    return null
  }

  if (showRaw) {
    const raw = explain.rawDisplay.trim()
    if (raw === '' || raw === 'undefined') {
      return null
    }
    return explain.rawDisplay
  }

  const lines: string[] = []

  lines.push('Diagnosis')
  pushRow(lines, 'Namespace', explain.namespace)
  pushRow(lines, 'Op', explain.op)
  pushRow(lines, 'Plan', explain.plan)
  if (explain.planSummary != null && explain.planSummary !== explain.plan) {
    pushRow(lines, 'Plan summary', explain.planSummary)
  }
  pushRow(lines, 'Duration', `${formatCount(explain.totalMillis)} ms`)
  pushRow(lines, 'Examined/ret', formatExaminedRet(explain.docsExamined, explain.nReturned))
  pushRow(lines, 'Stage', explain.stageDetail)
  lines.push('')

  lines.push('Filter / pipeline')
  lines.push(prettyDisplay(explain.filter))
  lines.push('')

  if (explain.suggestedIndex != null) {
    lines.push('Suggested index')
    lines.push(explain.suggestedIndex.command)
    lines.push(explain.suggestedIndex.reason)
    lines.push('')
  }

  lines.push('Pattern')
  pushRow(lines, 'Count', formatCount(pattern.count))
  pushRow(lines, 'Avg ms', formatCount(pattern.avgMs))
  pushRow(lines, 'Total ms', formatCount(pattern.totalDurationMs))
  pushRow(lines, 'Shape', pattern.shape)
  pushRow(lines, 'Trend', sparkline(pattern.trend))
  lines.push('')

  lines.push('Context')
  pushRow(lines, 'Timestamp', formatTimestamp(explain.timestampMs))
  pushRow(lines, 'Ctx', explain.ctx || 'n/a')
  pushRow(lines, 'App', explain.appName ?? 'n/a')
  pushRow(lines, 'Remote', explain.remote ?? 'n/a')
  pushRow(lines, 'Protocol', explain.protocol ?? 'n/a')
  lines.push('')

  const workRows: { label: string; value: string }[] = []
  if (explain.keysExamined != null) {
    workRows.push({ label: 'Keys exam.', value: formatCount(explain.keysExamined) })
  }
  if (explain.numYields != null) {
    workRows.push({ label: 'Yields', value: formatCount(explain.numYields) })
  }
  if (explain.reslen != null) {
    workRows.push({ label: 'Reslen', value: formatCount(explain.reslen) })
  }
  if (explain.cpuNanos != null) {
    workRows.push({ label: 'CPU', value: formatCpu(explain.cpuNanos) })
  }
  if (explain.workingMillis != null) {
    workRows.push({ label: 'Working', value: `${formatCount(explain.workingMillis)} ms` })
  }
  if (explain.waitForWriteConcernDurationMillis != null) {
    workRows.push({
      label: 'WC wait',
      value: `${formatCount(explain.waitForWriteConcernDurationMillis)} ms`,
    })
  }
  if (workRows.length > 0) {
    lines.push('Work')
    for (const row of workRows) {
      pushRow(lines, row.label, row.value)
    }
    lines.push('')
  }

  lines.push('Command')
  lines.push(explain.commandDisplay)

  const text = lines.join('\n').trimEnd()
  if (text === '' || text === 'undefined') {
    return null
  }
  return text
}

/**
 * Plain-text suggested index shell command, or null when none is shown.
 */
export function buildSuggestedIndexCopyText(explain: PatternExplain | null): string | null {
  const command = explain?.suggestedIndex?.command
  if (command == null) {
    return null
  }
  const trimmed = command.trim()
  if (trimmed === '' || trimmed === 'undefined') {
    return null
  }
  return command
}
