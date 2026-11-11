import { describe, expect, it } from 'vitest'
import { TREND_BUCKETS } from '../types'
import { compareHistoryWindows } from './compare'
import type { PatternHistory } from './types'

function emptyHistory(overrides: Partial<PatternHistory> = {}): PatternHistory {
  return {
    firstSeenSlowMs: 0,
    lastSeenSlowMs: 1000,
    sumDurationMs: new Float64Array(TREND_BUCKETS),
    sumDocsExamined: new Float64Array(TREND_BUCKETS),
    sumDocsReturned: new Float64Array(TREND_BUCKETS),
    bucketPlans: Array.from({ length: TREND_BUCKETS }, () => ''),
    planMix: [],
    ...overrides,
  }
}

describe('compareHistoryWindows', () => {
  it('marks empty windows as low confidence', () => {
    const comparison = compareHistoryWindows(emptyHistory(), new Uint16Array(TREND_BUCKETS))
    expect(comparison.early.count).toBe(0)
    expect(comparison.late.count).toBe(0)
    expect(comparison.lowConfidence).toBe(true)
  })

  it('marks a single-bucket sample as low confidence', () => {
    const trend = new Uint16Array(TREND_BUCKETS)
    const sumDurationMs = new Float64Array(TREND_BUCKETS)
    const sumDocsExamined = new Float64Array(TREND_BUCKETS)
    const sumDocsReturned = new Float64Array(TREND_BUCKETS)
    const bucketPlans = Array.from({ length: TREND_BUCKETS }, () => '')
    trend[0] = 1
    sumDurationMs[0] = 200
    sumDocsExamined[0] = 10
    sumDocsReturned[0] = 1
    bucketPlans[0] = 'COLLSCAN'

    const comparison = compareHistoryWindows(
      emptyHistory({
        sumDurationMs,
        sumDocsExamined,
        sumDocsReturned,
        bucketPlans,
      }),
      trend,
    )
    expect(comparison.early.count + comparison.late.count).toBe(1)
    expect(comparison.lowConfidence).toBe(true)
  })

  it('splits buckets by midpoint and computes averages', () => {
    const trend = new Uint16Array(TREND_BUCKETS)
    const sumDurationMs = new Float64Array(TREND_BUCKETS)
    const sumDocsExamined = new Float64Array(TREND_BUCKETS)
    const sumDocsReturned = new Float64Array(TREND_BUCKETS)
    const bucketPlans = Array.from({ length: TREND_BUCKETS }, () => '')

    // Early half: five IXSCAN buckets at 100ms. Late half: five COLLSCAN at 300ms.
    for (let i = 0; i < 5; i++) {
      trend[i] = 1
      sumDurationMs[i] = 100
      sumDocsExamined[i] = 10
      sumDocsReturned[i] = 1
      bucketPlans[i] = 'IXSCAN'
    }
    for (let i = 12; i < 17; i++) {
      trend[i] = 1
      sumDurationMs[i] = 300
      sumDocsExamined[i] = 100
      sumDocsReturned[i] = 1
      bucketPlans[i] = 'COLLSCAN'
    }

    const comparison = compareHistoryWindows(
      emptyHistory({
        firstSeenSlowMs: 0,
        lastSeenSlowMs: 1000,
        sumDurationMs,
        sumDocsExamined,
        sumDocsReturned,
        bucketPlans,
      }),
      trend,
    )
    expect(comparison.early.count).toBe(5)
    expect(comparison.late.count).toBe(5)
    expect(comparison.lowConfidence).toBe(false)
    expect(comparison.early.avgMs).toBe(100)
    expect(comparison.late.avgMs).toBe(300)
    expect(comparison.early.plan).toBe('IXSCAN')
    expect(comparison.late.plan).toBe('COLLSCAN')
  })

  it('skips empty buckets when assigning early/late', () => {
    const trend = new Uint16Array(TREND_BUCKETS)
    const sumDurationMs = new Float64Array(TREND_BUCKETS)
    const bucketPlans = Array.from({ length: TREND_BUCKETS }, () => '')
    trend[2] = 1
    sumDurationMs[2] = 50
    bucketPlans[2] = 'IXSCAN'
    trend[20] = 1
    sumDurationMs[20] = 50
    bucketPlans[20] = 'IXSCAN'

    const comparison = compareHistoryWindows(
      emptyHistory({
        sumDurationMs,
        bucketPlans,
      }),
      trend,
    )
    expect(comparison.early.count + comparison.late.count).toBe(2)
  })
})
