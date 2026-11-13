import { describe, expect, it } from 'vitest'
import { scoreFromComparison } from './regression'
import type { WindowComparison, WindowMetrics } from './types'

function metrics(overrides: Partial<WindowMetrics> = {}): WindowMetrics {
  return {
    count: 10,
    avgMs: 100,
    avgDocsExamined: 10,
    avgDocsReturned: 1,
    examinedPerReturned: 10,
    plan: 'IXSCAN',
    planMix: [{ plan: 'IXSCAN', count: 10 }],
    ...overrides,
  }
}

function comparison(overrides: Partial<WindowComparison> = {}): WindowComparison {
  return {
    early: metrics(),
    late: metrics(),
    splitMs: 500,
    lowConfidence: false,
    ...overrides,
  }
}

describe('scoreFromComparison', () => {
  it('flags low confidence when either window is below the minimum', () => {
    const result = scoreFromComparison(
      comparison({
        early: metrics({ count: 2 }),
        late: metrics({ count: 10, avgMs: 400 }),
        lowConfidence: true,
      }),
    )
    expect(result.lowConfidence).toBe(true)
  })

  it('scores avgMs growth and plan worsening', () => {
    const result = scoreFromComparison(
      comparison({
        early: metrics({ avgMs: 100, plan: 'IXSCAN' }),
        late: metrics({
          avgMs: 300,
          plan: 'COLLSCAN',
          examinedPerReturned: 10,
          planMix: [{ plan: 'COLLSCAN', count: 10 }],
        }),
      }),
    )
    expect(result.avgMsRatio).toBe(3)
    expect(result.planPenalty).toBe(1)
    expect(result.score).toBeGreaterThan(2)
  })

  it('does not invent a ratio when early avgMs is 0', () => {
    const result = scoreFromComparison(
      comparison({
        early: metrics({ avgMs: 0, examinedPerReturned: 0 }),
        late: metrics({ avgMs: 500, examinedPerReturned: 50 }),
      }),
    )
    expect(result.avgMsRatio).toBe(1)
    expect(result.examinedRatio).toBe(1)
  })
})
