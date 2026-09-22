import { describe, expect, it } from 'vitest'
import { horizontalBarString } from './horizontal-bar-string'

describe('horizontalBarString', () => {
  it('fills empty and full tracks', () => {
    expect(horizontalBarString(0, 20)).toBe(' '.repeat(20))
    expect(horizontalBarString(100, 20)).toBe('█'.repeat(20))
  })

  it('uses partial blocks for fractional fills', () => {
    expect(horizontalBarString(50, 10)).toBe(`${'█'.repeat(5)}${' '.repeat(5)}`)
    expect(horizontalBarString(55, 10)).toBe(`${'█'.repeat(5)}▌${' '.repeat(4)}`)
  })

  it('distinguishes close fill levels', () => {
    const bar81 = horizontalBarString(81, 20)
    const bar84 = horizontalBarString(84, 20)
    expect(bar81).not.toBe(bar84)
    expect(bar81.length).toBe(20)
    expect(bar84.length).toBe(20)
  })
})
