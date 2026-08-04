/** Fixed number of sparkline buckets over the pattern window. */
export const TREND_BUCKETS = 24

/** MongoDB log message id for "Slow query". */
export const SLOW_QUERY_ID = 51803

export type QueryPattern = {
  id: number
  namespace: string
  op: string
  shape: string
  count: number
  avgMs: number
  avgDocsExamined: number
  avgDocsReturned: number
  plan: string
  trend: Uint16Array
  sampleRow: number
  totalDurationMs: number
}

export type QueryPatternStore = {
  patterns: QueryPattern[]
  windowStartMs: number
  windowEndMs: number
  slowQueryCount: number
  buildDurationMs: number
}

export type IndexSuggestion = {
  command: string
  reason: string
  estimatedExamined: number
}

export type PatternExplain = {
  namespace: string
  plan: string
  filter: string
  docsExamined: number
  nReturned: number
  totalMillis: number
  stageDetail: string
  suggestedIndex: IndexSuggestion | null
}

/** Fields extracted from a single Slow query `attr` object. */
export type SlowQueryAttr = {
  namespace: string
  op: string
  shape: string
  durationMs: number
  docsExamined: number
  docsReturned: number
  plan: string
  /** Pretty-printed filter / query for explain views. */
  filterDisplay: string
  /** Equality field names for ESR index suggestions (empty if none). */
  equalityFields: string[]
}
