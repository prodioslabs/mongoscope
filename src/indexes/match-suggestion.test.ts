import { describe, expect, it } from 'vitest'
import { findIndexMatchingSuggestion } from './match-suggestion'
import type { IndexRow } from './types'

function row(partial: Partial<IndexRow> & Pick<IndexRow, 'name' | 'keyLabel'>): IndexRow {
  return {
    flags: [],
    sizeBytes: null,
    ops: null,
    since: null,
    building: false,
    buildPercent: null,
    buildMessage: null,
    ...partial,
  }
}

describe('findIndexMatchingSuggestion', () => {
  it('returns an exact keyLabel match', () => {
    const match = findIndexMatchingSuggestion(
      [row({ name: 'status_1', keyLabel: 'status:1' }), row({ name: '_id_', keyLabel: '_id:1' })],
      'status:1',
    )
    expect(match?.name).toBe('status_1')
  })

  it('returns a left-prefix covering index', () => {
    const match = findIndexMatchingSuggestion(
      [row({ name: 'compound', keyLabel: 'status:1,district:1,year:1' })],
      'status:1,district:1',
    )
    expect(match?.name).toBe('compound')
  })

  it('returns null when nothing covers the suggestion', () => {
    expect(
      findIndexMatchingSuggestion([row({ name: 'other_1', keyLabel: 'other:1' })], 'status:1'),
    ).toBeNull()
  })
})
