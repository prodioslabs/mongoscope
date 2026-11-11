/** Minimum samples required in each compare window for a confident regression score. */
export const REGRESSION_MIN_SAMPLES = 5

export type IndexMarkerKind =
  | 'index-build-start'
  | 'index-build-complete'
  | 'drop-indexes'
  | 'create-indexes'

export type IndexMarker = {
  timestampMs: number
  kind: IndexMarkerKind
  namespace: string
  /** Index name(s) or short label for the timeline. */
  label: string
}

/** Per-pattern time series collected while building from a static log. */
export type PatternHistory = {
  firstSeenSlowMs: number
  lastSeenSlowMs: number
  /** Sum of durationMillis per trend bucket (parallel to `QueryPattern.trend`). */
  sumDurationMs: Float64Array
  sumDocsExamined: Float64Array
  sumDocsReturned: Float64Array
  /** Modal normalized plan per bucket; empty string when the bucket has no samples. */
  bucketPlans: string[]
  /** Overall plan mix for the pattern (normalized short labels). */
  planMix: ReadonlyArray<{ plan: string; count: number }>
}

export type WindowMetrics = {
  count: number
  avgMs: number
  avgDocsExamined: number
  avgDocsReturned: number
  /** Examined/returned ratio; 0 when returned is 0. */
  examinedPerReturned: number
  /** Modal plan in this window, or `n/a`. */
  plan: string
  planMix: ReadonlyArray<{ plan: string; count: number }>
}

export type WindowComparison = {
  early: WindowMetrics
  late: WindowMetrics
  /** Midpoint timestamp used to split early/late (pattern span). */
  splitMs: number
  lowConfidence: boolean
}

export type PlanTransition = {
  fromPlan: string
  toPlan: string
  /** First sample timestamp of the new plan run. */
  atMs: number
  /** Last sample timestamp of the previous plan run (NaN if unknown). */
  previousLastMs: number
}

export type RegressionScore = {
  score: number
  lowConfidence: boolean
  avgMsRatio: number
  examinedRatio: number
  planPenalty: number
}
