import type { TopologyMember } from './types'

/** Keep lag samples covering this wall-clock window (session-only; no backfill). */
const LAG_HISTORY_WINDOW_MS = 10 * 60 * 1000

/** Number of vertical bars rendered in the lag trend chart. */
const LAG_CHART_BAR_COUNT = 28

type LagSample = {
  t: number
  lagSeconds: number
}

export type LagHistoryState = {
  memberId: number | null
  memberName: string | null
  samples: LagSample[]
}

export type LagTrendView = {
  memberId: number
  memberName: string
  /** Max-pooled bar heights (seconds) for chart columns. */
  bars: number[]
  peakLagSeconds: number
  currentLagSeconds: number
  sampleCount: number
  /** True until at least two samples exist for this member. */
  collecting: boolean
}

export function emptyLagHistory(): LagHistoryState {
  return {
    memberId: null,
    memberName: null,
    samples: [],
  }
}

/**
 * Prefer the most-lagged secondary; fall back to any non-primary data member.
 */
export function pickLagTrendMember(members: readonly TopologyMember[]): TopologyMember | null {
  let best: TopologyMember | null = null
  for (const member of members) {
    if (member.stateStr.toUpperCase() === 'PRIMARY') {
      continue
    }
    if (member.stateStr.toUpperCase() === 'ARBITER') {
      continue
    }
    if (member.lagSeconds == null) {
      continue
    }
    if (best == null || member.lagSeconds > (best.lagSeconds ?? -1)) {
      best = member
    }
  }
  return best
}

export function appendLagSample(
  previous: LagHistoryState,
  member: TopologyMember,
  nowMs: number = Date.now(),
  windowMs: number = LAG_HISTORY_WINDOW_MS,
): LagHistoryState {
  const lagSeconds = member.lagSeconds ?? 0
  let samples = previous.samples
  if (previous.memberId !== member.id) {
    samples = []
  }
  samples = [...samples, { t: nowMs, lagSeconds }]
  return pruneLagHistory(
    {
      memberId: member.id,
      memberName: member.name,
      samples,
    },
    nowMs,
    windowMs,
  )
}

export function pruneLagHistory(
  state: LagHistoryState,
  nowMs: number = Date.now(),
  windowMs: number = LAG_HISTORY_WINDOW_MS,
): LagHistoryState {
  const cutoff = nowMs - windowMs
  return {
    ...state,
    samples: state.samples.filter(function keepRecent(sample) {
      return sample.t >= cutoff
    }),
  }
}

export function buildLagTrendView(
  state: LagHistoryState,
  barCount: number = LAG_CHART_BAR_COUNT,
): LagTrendView | null {
  if (state.memberId == null || state.memberName == null || state.samples.length === 0) {
    return null
  }

  const lags = state.samples.map(function sampleLag(sample) {
    return sample.lagSeconds
  })
  let peakLagSeconds = 0
  for (const lag of lags) {
    if (lag > peakLagSeconds) {
      peakLagSeconds = lag
    }
  }
  const currentLagSeconds = lags[lags.length - 1] ?? 0

  return {
    memberId: state.memberId,
    memberName: state.memberName,
    bars: poolLagSamples(lags, barCount),
    peakLagSeconds,
    currentLagSeconds,
    sampleCount: state.samples.length,
    collecting: state.samples.length < 2,
  }
}

export function poolLagSamples(values: readonly number[], barCount: number): number[] {
  const count = Math.max(0, Math.floor(barCount))
  if (count === 0) {
    return []
  }
  if (values.length === 0) {
    return Array.from({ length: count }, () => 0)
  }

  const pooled = Array.from({ length: count }, () => 0)
  for (let i = 0; i < values.length; i++) {
    const bucket = Math.min(count - 1, Math.floor((i / values.length) * count))
    const value = values[i] ?? 0
    if (value > (pooled[bucket] ?? 0)) {
      pooled[bucket] = value
    }
  }
  return pooled
}
