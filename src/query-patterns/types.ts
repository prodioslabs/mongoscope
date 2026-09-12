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
  /** Full `db.collection` namespace from the slow-query sample. */
  namespace: string
  database: string
  collection: string
  equalityFields: string[]
  /** Compact key label matching Indexes inventory, e.g. `status:1,district:1`. */
  keyLabel: string
}

export type PatternExplain = {
  namespace: string
  op: string
  plan: string
  /** Full `planSummary` string when present (not the short UI label). */
  planSummary: string | null
  filter: string
  docsExamined: number
  nReturned: number
  totalMillis: number
  stageDetail: string
  suggestedIndex: IndexSuggestion | null
  /** Sample log timestamp (ms since epoch), or NaN if unknown. */
  timestampMs: number
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
  /** Pretty command JSON with session/cluster meta stripped. */
  commandDisplay: string
  /** Pretty full log envelope (or raw line) for the sample. */
  rawDisplay: string
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
