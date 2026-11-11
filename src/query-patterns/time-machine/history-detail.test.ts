import { describe, expect, it } from 'vitest'
import { TREND_BUCKETS } from '../types'
import { buildHistoryDetail } from './history-detail'
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

describe('buildHistoryDetail', () => {
  it('returns the live-unavailable notice when history is null', () => {
    const detail = buildHistoryDetail(
      {
        namespace: 'shop.orders',
        trend: new Uint16Array(TREND_BUCKETS),
        history: null,
      },
      [],
    )
    expect(detail.kind).toBe('unavailable')
    if (detail.kind !== 'unavailable') {
      return
    }
    expect(detail.notice).toContain('static log analysis only')
  })

  it('filters index markers to the pattern namespace and span', () => {
    const history = emptyHistory({
      firstSeenSlowMs: 100,
      lastSeenSlowMs: 200,
      planMix: [{ plan: 'COLLSCAN', count: 1 }],
    })
    const detail = buildHistoryDetail(
      {
        namespace: 'shop.orders',
        trend: new Uint16Array(TREND_BUCKETS),
        history,
      },
      [
        {
          timestampMs: 150,
          kind: 'drop-indexes',
          namespace: 'shop.orders',
          label: 'status_1',
        },
        {
          timestampMs: 150,
          kind: 'drop-indexes',
          namespace: 'shop.users',
          label: 'other',
        },
        {
          timestampMs: 50,
          kind: 'drop-indexes',
          namespace: 'shop.orders',
          label: 'too-early',
        },
      ],
    )
    expect(detail.kind).toBe('available')
    if (detail.kind !== 'available') {
      return
    }
    expect(detail.planMixLabel).toBe('COLLSCAN×1')
    expect(detail.indexMarkerLines).toHaveLength(1)
    expect(detail.indexMarkerLines[0]).toContain('status_1')
  })
})
