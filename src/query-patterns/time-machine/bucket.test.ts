import { describe, expect, it } from 'vitest'
import { avgMsPerBucket, bucketIndexForTimestamp, modalPlanFromCounts } from './bucket'

describe('bucketIndexForTimestamp', () => {
  it('returns null for non-finite timestamps', () => {
    expect(bucketIndexForTimestamp(Number.NaN, 0, 1000, 24)).toBeNull()
  })

  it('maps a single-sample span to bucket 0', () => {
    expect(bucketIndexForTimestamp(100, 100, 100, 24)).toBe(0)
  })

  it('clamps out-of-range timestamps into the window', () => {
    expect(bucketIndexForTimestamp(-50, 0, 1000, 10)).toBe(0)
    expect(bucketIndexForTimestamp(5000, 0, 1000, 10)).toBe(9)
  })

  it('handles timezone-derived epoch values across the window', () => {
    const start = Date.parse('2026-04-08T10:00:00.000+05:30')
    const end = Date.parse('2026-04-08T11:00:00.000+05:30')
    const mid = Date.parse('2026-04-08T10:30:00.000+05:30')
    expect(bucketIndexForTimestamp(mid, start, end, 24)).toBe(12)
  })
})

describe('avgMsPerBucket', () => {
  it('returns 0 for empty buckets', () => {
    const avg = avgMsPerBucket([0, 2], [0, 40])
    expect(Array.from(avg)).toEqual([0, 20])
  })
})

describe('modalPlanFromCounts', () => {
  it('returns n/a for an empty map', () => {
    expect(modalPlanFromCounts(new Map())).toBe('n/a')
  })

  it('picks the highest count plan', () => {
    expect(
      modalPlanFromCounts(
        new Map([
          ['IXSCAN', 2],
          ['COLLSCAN', 5],
        ]),
      ),
    ).toBe('COLLSCAN')
  })
})
