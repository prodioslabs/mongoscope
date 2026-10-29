import type { ExportablePattern, ExportableQueryDetail, SlowQueriesExportDocument } from './types'

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
  'detailPlanSummary',
  'detailFilter',
  'detailDocsExamined',
  'detailNReturned',
  'detailTotalMillis',
  'detailStage',
  'detailSuggestedIndexCommand',
  'detailSuggestedIndexReason',
  'detailTimestamp',
  'detailCtx',
  'detailAppName',
  'detailRemote',
  'detailProtocol',
  'detailKeysExamined',
  'detailNumYields',
  'detailReslen',
  'detailCpuNanos',
  'detailWorkingMillis',
  'detailWcWaitMillis',
  'detailCommand',
] as const

/**
 * RFC 4180 CSV for slow-query patterns + query detail.
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
  const detail = pattern.detail
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
    ...serializeDetailCells(detail),
  ].join(',')
}

function serializeDetailCells(detail: ExportableQueryDetail | null): string[] {
  if (detail == null) {
    return CSV_HEADER.slice(9).map(function emptyCell() {
      return ''
    })
  }
  return [
    quoteCsvString(detail.planSummary ?? ''),
    quoteCsvString(detail.filter),
    formatCsvNumber(detail.docsExamined),
    formatCsvNumber(detail.nReturned),
    formatCsvNumber(detail.totalMillis),
    quoteCsvString(detail.stageDetail),
    quoteCsvString(detail.suggestedIndexCommand ?? ''),
    quoteCsvString(detail.suggestedIndexReason ?? ''),
    quoteCsvString(detail.timestamp ?? ''),
    quoteCsvString(detail.ctx),
    quoteCsvString(detail.appName ?? ''),
    quoteCsvString(detail.remote ?? ''),
    quoteCsvString(detail.protocol ?? ''),
    formatOptionalNumber(detail.keysExamined),
    formatOptionalNumber(detail.numYields),
    formatOptionalNumber(detail.reslen),
    formatOptionalNumber(detail.cpuNanos),
    formatOptionalNumber(detail.workingMillis),
    formatOptionalNumber(detail.waitForWriteConcernDurationMillis),
    quoteCsvString(detail.command),
  ]
}

function formatOptionalNumber(value: number | null): string {
  if (value == null) {
    return ''
  }
  return formatCsvNumber(value)
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
    value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')
  )
}
