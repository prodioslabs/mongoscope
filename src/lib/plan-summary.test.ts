import { describe, expect, it } from 'vitest'
import { normalizePlanSummary } from './plan-summary'

describe('normalizePlanSummary', () => {
  it('maps COLLSCAN', () => {
    expect(normalizePlanSummary('COLLSCAN')).toBe('COLLSCAN')
  })

  it('maps IXSCAN and strips index details', () => {
    expect(normalizePlanSummary('IXSCAN { status: 1 }')).toBe('IXSCAN')
  })

  it('maps IXSCAN with SORT', () => {
    expect(normalizePlanSummary('IXSCAN { a: 1 }, SORT')).toBe('IXSCAN+SORT')
    expect(normalizePlanSummary('IXSCAN { a: 1 }, SORT_KEY_GENERATOR')).toBe('IXSCAN+SORT')
  })

  it('returns n/a for missing', () => {
    expect(normalizePlanSummary(undefined)).toBe('n/a')
    expect(normalizePlanSummary('')).toBe('n/a')
  })
})
