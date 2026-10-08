import { sparkline } from '../../lib/sparkline'
import type { ExportablePattern, SlowQueriesExportDocument } from './types'

const MD_HEADERS = [
  'namespace',
  'op',
  'shape',
  'count',
  'avgMs',
  'avgDocsExamined',
  'avgDocsReturned',
  'plan',
  'totalDurationMs',
  'trend',
] as const

const MAX_CELL_LEN = 80

/**
 * Markdown table export. Pipes and newlines in cells are escaped so rows
 * stay on a single line; long values are truncated with an ellipsis.
 * Trend uses the plain-text sparkline helper (no styling).
 */
export function serializeSlowQueriesMarkdown(document: SlowQueriesExportDocument): string {
  const { metadata, patterns } = document
  const headingLines = [
    `# Slow query patterns`,
    '',
    `- source: ${metadata.source}`,
    `- exported: ${metadata.exportedAt}`,
    `- patterns: ${metadata.patternCount}`,
  ]
  if (metadata.label != null && metadata.label !== '') {
    headingLines.push(`- label: ${escapeInline(metadata.label)}`)
  }
  headingLines.push(
    `- window: ${metadata.windowStartMs}–${metadata.windowEndMs} (${metadata.trendBucketCount} trend buckets)`,
  )
  if (metadata.sampleLimit != null) {
    headingLines.push(`- sample limit: ${metadata.sampleLimit}`)
  }
  headingLines.push(
    `- sort: ${metadata.sort.by} ${metadata.sort.direction}`,
    '',
  )

  const header = `| ${MD_HEADERS.join(' | ')} |`
  const separator = `| ${MD_HEADERS.map(() => '---').join(' | ')} |`
  const rows = patterns.map(function formatRow(pattern) {
    return `| ${MD_HEADERS.map(function cellFor(key) {
      return escapeCell(cellValue(pattern, key))
    }).join(' | ')} |`
  })

  return `${headingLines.join('\n')}${header}\n${separator}\n${rows.join('\n')}\n`
}

function cellValue(
  pattern: ExportablePattern,
  key: (typeof MD_HEADERS)[number],
): string {
  if (key === 'trend') {
    return sparkline(pattern.trend)
  }
  const value = pattern[key]
  if (typeof value === 'number') {
    return String(value)
  }
  return value
}

function escapeCell(value: string): string {
  const singleLine = value.replaceAll('|', '\\|').replaceAll('\r\n', ' ').replaceAll('\n', ' ').replaceAll('\r', ' ')
  if (singleLine.length <= MAX_CELL_LEN) {
    return singleLine
  }
  return `${singleLine.slice(0, MAX_CELL_LEN - 1)}…`
}

function escapeInline(value: string): string {
  return value.replaceAll('\n', ' ').replaceAll('\r', ' ')
}
