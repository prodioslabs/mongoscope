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
  /** Fixed trend bucket count so exported trend arrays are interpretable. */
  trendBucketCount: number
  /** Live only: newest system.profile docs sampled. */
  sampleLimit?: number
  /** ISO 8601 UTC. */
  exportedAt: string
  sort: ExportSort
  patternCount: number
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
  trend: number[]
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
