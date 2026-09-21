import { describe, expect, it } from 'vitest'
import { diffGetLogLines } from './diff-get-log'

describe('diffGetLogLines', () => {
  it('returns all current lines on first poll', () => {
    const result = diffGetLogLines([], ['a', 'b', 'c'])
    expect(result).toEqual({ newLines: ['a', 'b', 'c'], wrapped: false })
  })

  it('returns only lines after the overlapping suffix/prefix', () => {
    const previous = ['a', 'b', 'c', 'd']
    const current = ['b', 'c', 'd', 'e', 'f']
    expect(diffGetLogLines(previous, current)).toEqual({
      newLines: ['e', 'f'],
      wrapped: false,
    })
  })

  it('returns empty when the window is unchanged', () => {
    const lines = ['a', 'b', 'c']
    expect(diffGetLogLines(lines, lines)).toEqual({ newLines: [], wrapped: false })
  })

  it('marks wrapped when there is no overlap', () => {
    const result = diffGetLogLines(['old1', 'old2'], ['new1', 'new2', 'new3'])
    expect(result.wrapped).toBe(true)
    expect(result.newLines).toEqual(['new1', 'new2', 'new3'])
  })
})
