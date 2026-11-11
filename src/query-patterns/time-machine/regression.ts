import { compareHistoryWindows } from './compare'
import type { PatternHistory, RegressionScore, WindowComparison, WindowMetrics } from './types'

const WEIGHT_AVG_MS = 1
const WEIGHT_EXAMINED = 0.5
const WEIGHT_PLAN = 1

/** Plans ordered from better to worse for penalty scoring. */
const PLAN_RANK: Record<string, number> = {
  IXSCAN: 0,
  'IXSCAN+SORT': 1,
  COUNT_SCAN: 1,
  COLLSCAN: 2,
}

/**
 * Higher score ⇒ more likely regression (avgMs up, examined/ret up, plan worse).
 * Always sets `lowConfidence` when either window is below the min sample count.
 */
export function scoreRegression(
  history: PatternHistory,
  trend: ArrayLike<number>,
): RegressionScore {
  const comparison = compareHistoryWindows(history, trend)
  return scoreFromComparison(comparison)
}

export function scoreFromComparison(comparison: WindowComparison): RegressionScore {
  const avgMsRatio = ratioOrOne(comparison.late.avgMs, comparison.early.avgMs)
  const examinedRatio = ratioOrOne(
    comparison.late.examinedPerReturned,
    comparison.early.examinedPerReturned,
  )
  const planPenalty = planChangePenalty(comparison.early, comparison.late)

  const score =
    WEIGHT_AVG_MS * clamp(avgMsRatio - 1, 0, 5) +
    WEIGHT_EXAMINED * clamp(examinedRatio - 1, 0, 5) +
    WEIGHT_PLAN * planPenalty

  return {
    score,
    lowConfidence: comparison.lowConfidence,
    avgMsRatio,
    examinedRatio,
    planPenalty,
  }
}

function planChangePenalty(early: WindowMetrics, late: WindowMetrics): number {
  if (early.plan === 'n/a' || late.plan === 'n/a') {
    return collscanSharePenalty(early, late)
  }

  const earlyRank = PLAN_RANK[early.plan]
  const lateRank = PLAN_RANK[late.plan]
  if (earlyRank != null && lateRank != null && lateRank > earlyRank) {
    return 1
  }

  return collscanSharePenalty(early, late)
}

function collscanSharePenalty(early: WindowMetrics, late: WindowMetrics): number {
  const earlyShare = planShare(early, 'COLLSCAN')
  const lateShare = planShare(late, 'COLLSCAN')
  if (lateShare - earlyShare >= 0.25) {
    return 0.5
  }
  return 0
}

function planShare(metrics: WindowMetrics, plan: string): number {
  if (metrics.count <= 0) {
    return 0
  }
  for (const entry of metrics.planMix) {
    if (entry.plan === plan) {
      return entry.count / metrics.count
    }
  }
  return 0
}

function ratioOrOne(late: number, early: number): number {
  if (!(early > 0) || !Number.isFinite(early) || !Number.isFinite(late)) {
    return 1
  }
  return late / early
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min
  }
  if (value > max) {
    return max
  }
  return value
}
