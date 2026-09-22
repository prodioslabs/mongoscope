export type GetLogDiffResult = {
  /** Lines in `current` that are new since `previous` (oldest → newest). */
  newLines: string[]
  /** No overlap found — server RAM ring likely rotated past our previous window. */
  wrapped: boolean
}

/**
 * Diff two getLog windows (oldest → newest, ≤ ~1024). Finds the longest
 * previous-suffix / current-prefix overlap; lines after it are new.
 * No overlap ⇒ whole `current` is new and `wrapped` is true.
 */
export function diffGetLogLines(previous: string[], current: string[]): GetLogDiffResult {
  if (current.length === 0) {
    return { newLines: [], wrapped: false }
  }
  if (previous.length === 0) {
    return { newLines: current.slice(), wrapped: false }
  }

  const maxOverlap = Math.min(previous.length, current.length)
  for (let overlap = maxOverlap; overlap > 0; overlap--) {
    if (suffixEqualsPrefix(previous, current, overlap)) {
      return {
        newLines: current.slice(overlap),
        wrapped: false,
      }
    }
  }

  return { newLines: current.slice(), wrapped: true }
}

function suffixEqualsPrefix(previous: string[], current: string[], overlap: number): boolean {
  const prevStart = previous.length - overlap
  for (let i = 0; i < overlap; i++) {
    if (previous[prevStart + i] !== current[i]) {
      return false
    }
  }
  return true
}
