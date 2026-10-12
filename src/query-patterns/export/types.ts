export type ExportFormat = 'json' | 'csv' | 'markdown'

export type ExportSort = {
  by: 'count' | 'avgMs' | 'plan'
  direction: 'asc' | 'desc'
}

export type ExportSource = 'static' | 'live'

export type SlowQueriesExportMetadata = {
  mongoscopeVersion: string
  source: ExportSource
  /** Log basename (static) or selected database name (live). Omitted when unavailable. */
  label?: string
  windowStartMs: number
  windowEndMs: number
  /** Live only: newest system.profile docs sampled. */
  sampleLimit?: number
  /** ISO 8601 UTC. */
  exportedAt: string
  sort: ExportSort
  patternCount: number
}

/** Sample-level fields from the query detail dialog (default view, not raw). */
export type ExportableQueryDetail = {
  planSummary: string | null
  filter: string
  docsExamined: number
  nReturned: number
  totalMillis: number
  stageDetail: string
  suggestedIndexCommand: string | null
  suggestedIndexReason: string | null
  /** ISO 8601 UTC, or null when unknown. */
  timestamp: string | null
  ctx: string
  appName: string | null
  remote: string | null
  protocol: string | null
  keysExamined: number | null
  numYields: number | null
  reslen: number | null
  cpuNanos: number | null
  workingMillis: number | null
  waitForWriteConcernDurationMillis: number | null
  command: string
}

export type ExportablePattern = {
  namespace: string
  op: string
  shape: string
  count: number
  avgMs: number
  avgDocsExamined: number
  avgDocsReturned: number
  plan: string
  totalDurationMs: number
  /** Slowest-sample query detail; null when explain could not be built. */
  detail: ExportableQueryDetail | null
}

export type SlowQueriesExportDocument = {
  metadata: SlowQueriesExportMetadata
  patterns: ExportablePattern[]
}

export const EXPORT_FORMATS: readonly ExportFormat[] = ['json', 'csv', 'markdown']

export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  json: 'json',
  csv: 'csv',
  markdown: 'md',
}
