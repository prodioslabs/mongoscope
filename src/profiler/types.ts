import type { QueryPattern } from '../query-patterns'

export const DEFAULT_SLOWMS = 100
/** Fallback when a caller does not pass an explicit sample limit. */
export const PROFILE_FETCH_LIMIT = 1000
export const PROFILE_FETCH_LIMIT_PRESETS = [10_000, 25_000, 50_000, 100_000, 250_000] as const
export type ProfileFetchLimitPreset = (typeof PROFILE_FETCH_LIMIT_PRESETS)[number]
export const DEFAULT_PROFILE_FETCH_LIMIT: ProfileFetchLimitPreset = 100_000
export const MIN_PROFILE_FETCH_LIMIT = 1
export const MAX_PROFILE_FETCH_LIMIT = 1_000_000

export type ProfilerPanelErrorKind = 'permission' | 'unavailable' | 'unknown'

export type ProfilerPanelError = {
  kind: ProfilerPanelErrorKind
  message: string
}

export type ProfilingStatus = {
  level: number
  slowms: number
}

/** In-memory sample used for aggregation + explain (raw system.profile doc). */
export type ProfileSample = {
  doc: unknown
  attr: unknown
  timestampMs: number
}

export type ProfilerSlowQueriesSnapshot = {
  database: string
  databases: string[]
  profiling: ProfilingStatus | null
  patterns: QueryPattern[]
  /** Raw profile docs; `pattern.sampleRow` indexes into this array. */
  samples: unknown[]
  windowStartMs: number
  windowEndMs: number
  slowQueryCount: number
  errors: {
    databases: ProfilerPanelError | null
    status: ProfilerPanelError | null
    read: ProfilerPanelError | null
    topology: ProfilerPanelError | null
  }
}
