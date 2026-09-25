import { describe, expect, it } from 'vitest'
import { formatCount } from './format-count'

describe('formatCount', () => {
  it('formats with grouping', () => {
    expect(formatCount(12)).toBe('12')
    expect(formatCount(1200)).toBe('1,200')
    expect(formatCount(8412)).toBe('8,412')
  })

  it('rounds fractional values', () => {
    expect(formatCount(12.4)).toBe('12')
    expect(formatCount(12.6)).toBe('13')
  })
})
