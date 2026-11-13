import type { PatternHistory, PlanTransition } from './types'

/**
 * Detect modal-plan changes across non-empty buckets.
 * Empty buckets are skipped so gaps do not invent transitions.
 */
export function detectPlanTransitions(history: PatternHistory): PlanTransition[] {
  const transitions: PlanTransition[] = []
  const bucketCount = history.bucketPlans.length
  if (bucketCount === 0) {
    return transitions
  }

  const span = Math.max(1, history.lastSeenSlowMs - history.firstSeenSlowMs)
  let previousPlan: string | null = null
  let previousLastMs = Number.NaN

  for (let i = 0; i < bucketCount; i++) {
    const plan = history.bucketPlans[i] ?? ''
    if (plan === '') {
      continue
    }

    const bucketStart = history.firstSeenSlowMs + (span * i) / bucketCount
    const bucketEnd = history.firstSeenSlowMs + (span * (i + 1)) / bucketCount

    if (previousPlan == null) {
      previousPlan = plan
      previousLastMs = bucketEnd
      continue
    }

    if (plan !== previousPlan) {
      transitions.push({
        fromPlan: previousPlan,
        toPlan: plan,
        atMs: bucketStart,
        previousLastMs,
      })
      previousPlan = plan
    }
    previousLastMs = bucketEnd
  }

  return transitions
}
