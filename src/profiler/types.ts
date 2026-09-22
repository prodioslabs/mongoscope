import type { PanelError, PanelErrorKind } from '../lib/panel-error'
import type { QueryPattern } from '../query-patterns'

export const DEFAULT_SLOWMS = 100
export const PROFILE_FETCH_LIMIT = 1000
export const PROFILE_FETCH_LIMIT_PRESETS = [10_000, 25_000, 50_000, 100_000, 250_000] as const
export type ProfileFetchLimitPreset = (typeof PROFILE_FETCH_LIMIT_PRESETS)[number]
export const DEFAULT_PROFILE_FETCH_LIMIT: ProfileFetchLimitPreset = 100_000
export const MIN_PROFILE_FETCH_LIMIT = 1
export const MAX_PROFILE_FETCH_LIMIT = 1_000_000

export type ProfilerPanelErrorKind = PanelErrorKind
export type ProfilerPanelError = PanelError

export type ProfilingStatus = {
  level: number
  slowms: number
}

/** One system.profile sample for aggregation / explain. */
export type ProfileSample = {
  doc: Record<string, unknown>
  /** Attr-shaped payload for shape extraction (millis → durationMillis). */
  attr: Record<string, unknown>
  timestampMs: number
}

export type ProfilerSlowQueriesSnapshot = {
  database: string
  databases: string[]
  profiling: ProfilingStatus | null
  patterns: QueryPattern[]
  /** Raw profile docs; `pattern.sampleRow` indexes into this array. */
  samples: Record<string, unknown>[]
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
