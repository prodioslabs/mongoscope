import { describe, expect, it } from 'vitest'
import { formatDefaultWriteConcern, normalizeWriteConcern } from './write-concern'

describe('normalizeWriteConcern', () => {
  it('reads default w and source', () => {
    expect(
      normalizeWriteConcern({
        defaultWriteConcern: { w: 'majority' },
        defaultWriteConcernSource: 'global',
      }),
    ).toEqual({ defaultW: 'majority', source: 'global' })
  })

  it('handles numeric w and missing defaults', () => {
    expect(normalizeWriteConcern({ defaultWriteConcern: { w: 1 } }).defaultW).toBe('1')
    expect(normalizeWriteConcern({})).toEqual({ defaultW: null, source: null })
  })
})

describe('formatDefaultWriteConcern', () => {
  it('falls back to implicit when unset', () => {
    expect(formatDefaultWriteConcern(null)).toBe('implicit')
    expect(formatDefaultWriteConcern({ defaultW: null, source: null })).toBe('implicit')
    expect(formatDefaultWriteConcern({ defaultW: 'majority', source: 'global' })).toBe('majority')
  })
})
