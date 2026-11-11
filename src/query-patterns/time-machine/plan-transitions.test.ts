import { describe, expect, it } from 'vitest'
import { TREND_BUCKETS } from '../types'
import { detectPlanTransitions } from './plan-transitions'
import type { PatternHistory } from './types'

function historyWithPlans(plans: string[]): PatternHistory {
  const bucketPlans = Array.from({ length: TREND_BUCKETS }, (_, i) => plans[i] ?? '')
  return {
    firstSeenSlowMs: 0,
    lastSeenSlowMs: 2400,
    sumDurationMs: new Float64Array(TREND_BUCKETS),
    sumDocsExamined: new Float64Array(TREND_BUCKETS),
    sumDocsReturned: new Float64Array(TREND_BUCKETS),
    bucketPlans,
    planMix: [],
  }
}

describe('detectPlanTransitions', () => {
  it('returns no transitions when the plan is stable', () => {
    const plans = Array.from({ length: TREND_BUCKETS }, () => 'IXSCAN')
    expect(detectPlanTransitions(historyWithPlans(plans))).toEqual([])
  })

  it('detects IXSCAN to COLLSCAN across non-empty buckets', () => {
    const plans = Array.from({ length: TREND_BUCKETS }, (_, i) => (i < 10 ? 'IXSCAN' : 'COLLSCAN'))
    const transitions = detectPlanTransitions(historyWithPlans(plans))
    expect(transitions).toHaveLength(1)
    expect(transitions[0]!.fromPlan).toBe('IXSCAN')
    expect(transitions[0]!.toPlan).toBe('COLLSCAN')
  })

  it('skips empty buckets so gaps do not invent transitions', () => {
    const plans = Array.from({ length: TREND_BUCKETS }, () => '')
    plans[2] = 'IXSCAN'
    plans[3] = 'IXSCAN'
    plans[10] = 'IXSCAN'
    plans[11] = 'COLLSCAN'
    const transitions = detectPlanTransitions(historyWithPlans(plans))
    expect(transitions).toHaveLength(1)
    expect(transitions[0]!.fromPlan).toBe('IXSCAN')
    expect(transitions[0]!.toPlan).toBe('COLLSCAN')
  })

  it('handles a truncated single-bucket history', () => {
    const history: PatternHistory = {
      firstSeenSlowMs: 100,
      lastSeenSlowMs: 100,
      sumDurationMs: new Float64Array([50]),
      sumDocsExamined: new Float64Array([1]),
      sumDocsReturned: new Float64Array([1]),
      bucketPlans: ['COLLSCAN'],
      planMix: [{ plan: 'COLLSCAN', count: 1 }],
    }
    expect(detectPlanTransitions(history)).toEqual([])
  })
})
