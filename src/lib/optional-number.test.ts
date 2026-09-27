import { describe, expect, it } from 'vitest'
import { optionalNumber } from './optional-number'

describe('optionalNumber', () => {
  it('returns finite numbers', () => {
    expect(optionalNumber(0)).toBe(0)
    expect(optionalNumber(42.5)).toBe(42.5)
  })

  it('rejects non-finite numbers', () => {
    expect(optionalNumber(Number.NaN)).toBeNull()
    expect(optionalNumber(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('coerces bigint and Long-like toNumber()', () => {
    expect(optionalNumber(10n)).toBe(10)
    expect(optionalNumber({ toNumber: () => 99 })).toBe(99)
    expect(optionalNumber({ toNumber: () => Number.NaN })).toBeNull()
  })

  it('returns null for non-numeric values', () => {
    expect(optionalNumber(null)).toBeNull()
    expect(optionalNumber('12')).toBeNull()
    expect(optionalNumber({})).toBeNull()
  })
})
