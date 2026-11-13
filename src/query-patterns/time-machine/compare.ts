import { TREND_BUCKETS } from '../types'
import { modalPlanFromCounts, planMixFromCounts } from './bucket'
import {
  REGRESSION_MIN_SAMPLES,
  type PatternHistory,
  type WindowComparison,
  type WindowMetrics,
} from './types'

/**
 * Compare early vs late halves of a pattern's own slow-sample span.
 * Split is the midpoint of `[firstSeenSlow, lastSeenSlow]`.
 */
export function compareHistoryWindows(
  history: PatternHistory,
  trend: ArrayLike<number>,
): WindowComparison {
  const splitMs = history.firstSeenSlowMs + (history.lastSeenSlowMs - history.firstSeenSlowMs) / 2
  return compareFromBuckets(history, trend, splitMs)
}

function compareFromBuckets(
  history: PatternHistory,
  trend: ArrayLike<number>,
  splitMs: number,
): WindowComparison {
  const bucketCount = Math.min(
    TREND_BUCKETS,
    trend.length,
    history.sumDurationMs.length,
    history.bucketPlans.length,
  )
  const span = Math.max(1, history.lastSeenSlowMs - history.firstSeenSlowMs)

  const earlyPlans = new Map<string, number>()
  const latePlans = new Map<string, number>()
  let earlyCount = 0
  let lateCount = 0
  let earlySumMs = 0
  let lateSumMs = 0
  let earlySumExam = 0
  let lateSumExam = 0
  let earlySumRet = 0
  let lateSumRet = 0

  for (let i = 0; i < bucketCount; i++) {
    const count = trend[i] ?? 0
    if (count <= 0) {
      continue
    }
    // Bucket center time for early/late assignment.
    const bucketStart = history.firstSeenSlowMs + (span * i) / bucketCount
    const bucketEnd = history.firstSeenSlowMs + (span * (i + 1)) / bucketCount
    const center = (bucketStart + bucketEnd) / 2
    const sumMs = history.sumDurationMs[i] ?? 0
    const sumExam = history.sumDocsExamined[i] ?? 0
    const sumRet = history.sumDocsReturned[i] ?? 0
    const plan = history.bucketPlans[i] ?? 'n/a'

    if (center <= splitMs) {
      earlyCount += count
      earlySumMs += sumMs
      earlySumExam += sumExam
      earlySumRet += sumRet
      if (plan !== '') {
        earlyPlans.set(plan, (earlyPlans.get(plan) ?? 0) + count)
      }
    } else {
      lateCount += count
      lateSumMs += sumMs
      lateSumExam += sumExam
      lateSumRet += sumRet
      if (plan !== '') {
        latePlans.set(plan, (latePlans.get(plan) ?? 0) + count)
      }
    }
  }

  const early = metricsFromTotals(earlyCount, earlySumMs, earlySumExam, earlySumRet, earlyPlans)
  const late = metricsFromTotals(lateCount, lateSumMs, lateSumExam, lateSumRet, latePlans)
  return {
    early,
    late,
    splitMs,
    lowConfidence: early.count < REGRESSION_MIN_SAMPLES || late.count < REGRESSION_MIN_SAMPLES,
  }
}

function metricsFromTotals(
  count: number,
  sumMs: number,
  sumExam: number,
  sumRet: number,
  plans: Map<string, number>,
): WindowMetrics {
  const avgMs = count > 0 ? Math.round(sumMs / count) : 0
  const avgDocsExamined = count > 0 ? Math.round(sumExam / count) : 0
  const avgDocsReturned = count > 0 ? Math.round(sumRet / count) : 0
  const examinedPerReturned = sumRet > 0 ? sumExam / sumRet : 0
  return {
    count,
    avgMs,
    avgDocsExamined,
    avgDocsReturned,
    examinedPerReturned,
    plan: modalPlanFromCounts(plans),
    planMix: planMixFromCounts(plans),
  }
}
