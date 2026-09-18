import type { IndexRow } from './types'

/**
 * Find an inventory index that covers a Slow Queries ESR suggestion keyLabel
 * (`a:1,b:1`). Exact match wins; otherwise a left-prefix covering index.
 */
export function findIndexMatchingSuggestion(
  indexes: IndexRow[],
  keyLabel: string,
): IndexRow | null {
  const suggested = keyLabel.trim()
  if (suggested === '' || suggested === '—') {
    return null
  }

  const exact = indexes.find((index) => index.keyLabel === suggested)
  if (exact != null) {
    return exact
  }

  const suggestedParts = suggested.split(',')
  for (const index of indexes) {
    const parts = index.keyLabel.split(',')
    if (parts.length < suggestedParts.length) {
      continue
    }
    const covers = suggestedParts.every(function partMatches(part, partIndex) {
      return parts[partIndex] === part
    })
    if (covers) {
      return index
    }
  }

  return null
}
