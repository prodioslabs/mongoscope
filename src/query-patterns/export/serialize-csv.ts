import type { ExportablePattern, SlowQueriesExportDocument } from './types'

const CSV_HEADER = [
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

/**
 * RFC 4180 CSV for slow-query patterns.
 *
 * Formula injection: string cells whose first character is `=`, `+`, `-`, `@`,
 * tab, or carriage return are prefixed with a single quote so spreadsheet apps
 * treat them as text. Numeric columns are emitted as raw numbers (including
 * negatives and zero) so they stay numeric in spreadsheets.
 */
export function serializeSlowQueriesCsv(document: SlowQueriesExportDocument): string {
  const lines: string[] = [CSV_HEADER.join(',')]
  for (const pattern of document.patterns) {
    lines.push(serializePatternRow(pattern))
  }
  return `${lines.join('\n')}\n`
}

function serializePatternRow(pattern: ExportablePattern): string {
  return [
    quoteCsvString(pattern.namespace),
    quoteCsvString(pattern.op),
    quoteCsvString(pattern.shape),
    formatCsvNumber(pattern.count),
    formatCsvNumber(pattern.avgMs),
    formatCsvNumber(pattern.avgDocsExamined),
    formatCsvNumber(pattern.avgDocsReturned),
    quoteCsvString(pattern.plan),
    formatCsvNumber(pattern.totalDurationMs),
    quoteCsvString(formatTrendCell(pattern.trend)),
  ].join(',')
}

function formatTrendCell(trend: readonly number[]): string {
  return trend.join(';')
}

function formatCsvNumber(value: number): string {
  return String(value)
}

function quoteCsvString(value: string): string {
  const neutralized = neutralizeFormula(value)
  if (needsCsvQuotes(neutralized)) {
    return `"${neutralized.replaceAll('"', '""')}"`
  }
  return neutralized
}

function neutralizeFormula(value: string): string {
  if (value.length === 0) {
    return value
  }
  const first = value.charAt(0)
  if (
    first === '=' ||
    first === '+' ||
    first === '-' ||
    first === '@' ||
    first === '\t' ||
    first === '\r'
  ) {
    return `'${value}`
  }
  return value
}

function needsCsvQuotes(value: string): boolean {
  return (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  )
}
