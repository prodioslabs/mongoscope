import { describe, expect, it } from 'vitest'
import { truncateText } from './truncate-text'

describe('truncateText', () => {
  it('truncates with an ellipsis', () => {
    expect(truncateText('abcdefghij', 6)).toBe('abcde…')
    expect(truncateText('short', 10)).toBe('short')
  })

  it('handles tiny max lengths', () => {
    expect(truncateText('ab', 1)).toBe('…')
    expect(truncateText('ab', 0)).toBe('…')
  })
})
