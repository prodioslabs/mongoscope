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

  it('marks a single sample as low confidence', () => {
    const comparison = compareHistoryWindows(emptyHistory(), new Uint16Array(TREND_BUCKETS), [
      {
        timestampMs: 100,
        durationMs: 200,
        docsExamined: 10,
        docsReturned: 1,
        plan: 'COLLSCAN',
      },
    ])
    expect(comparison.early.count + comparison.late.count).toBe(1)
    expect(comparison.lowConfidence).toBe(true)
  })

  it('splits samples by midpoint and computes averages', () => {
    const samples = [
      {
        timestampMs: 0,
        durationMs: 100,
        docsExamined: 10,
        docsReturned: 1,
        plan: 'IXSCAN',
      },
      {
        timestampMs: 100,
        durationMs: 100,
        docsExamined: 10,
        docsReturned: 1,
        plan: 'IXSCAN',
      },
      {
        timestampMs: 200,
        durationMs: 100,
        docsExamined: 10,
        docsReturned: 1,
        plan: 'IXSCAN',
      },
      {
        timestampMs: 300,
        durationMs: 100,
        docsExamined: 10,
        docsReturned: 1,
        plan: 'IXSCAN',
      },
      {
        timestampMs: 400,
        durationMs: 100,
        docsExamined: 10,
        docsReturned: 1,
        plan: 'IXSCAN',
      },
      {
        timestampMs: 600,
        durationMs: 300,
        docsExamined: 100,
        docsReturned: 1,
        plan: 'COLLSCAN',
      },
      {
        timestampMs: 700,
        durationMs: 300,
        docsExamined: 100,
        docsReturned: 1,
        plan: 'COLLSCAN',
      },
      {
        timestampMs: 800,
        durationMs: 300,
        docsExamined: 100,
        docsReturned: 1,
        plan: 'COLLSCAN',
      },
      {
        timestampMs: 900,
        durationMs: 300,
        docsExamined: 100,
        docsReturned: 1,
        plan: 'COLLSCAN',
      },
      {
        timestampMs: 1000,
        durationMs: 300,
        docsExamined: 100,
        docsReturned: 1,
        plan: 'COLLSCAN',
      },
    ]
    const history = emptyHistory({
      firstSeenSlowMs: 0,
      lastSeenSlowMs: 1000,
    })
    const comparison = compareHistoryWindows(history, new Uint16Array(TREND_BUCKETS), samples)
    expect(comparison.early.count).toBe(5)
    expect(comparison.late.count).toBe(5)
    expect(comparison.lowConfidence).toBe(false)
    expect(comparison.early.avgMs).toBe(100)
    expect(comparison.late.avgMs).toBe(300)
    expect(comparison.early.plan).toBe('IXSCAN')
    expect(comparison.late.plan).toBe('COLLSCAN')
  })

  it('ignores out-of-order non-finite timestamps when using samples', () => {
    const comparison = compareHistoryWindows(emptyHistory(), new Uint16Array(TREND_BUCKETS), [
      {
        timestampMs: Number.NaN,
        durationMs: 999,
        docsExamined: 1,
        docsReturned: 1,
        plan: 'COLLSCAN',
      },
      {
        timestampMs: 800,
        durationMs: 50,
        docsExamined: 1,
        docsReturned: 1,
        plan: 'IXSCAN',
      },
      {
        timestampMs: 100,
        durationMs: 50,
        docsExamined: 1,
        docsReturned: 1,
        plan: 'IXSCAN',
      },
    ])
    expect(comparison.early.count + comparison.late.count).toBe(2)
  })
})
