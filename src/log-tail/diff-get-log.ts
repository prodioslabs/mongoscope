export type GetLogDiffResult = {
  /** Lines from `current` that are new since `previous` (oldest → newest). */
  newLines: string[]
  /**
   * True when no suffix/prefix overlap was found — the server RAM ring likely
   * rotated past everything we had seen (or the buffer was empty before).
   */
  wrapped: boolean
}

/**
 * Detect lines that appeared since the last getLog poll.
 *
 * getLog returns the current RAM window (oldest → newest, ≤ ~1024). We find the
 * longest overlap of `previous` suffix with `current` prefix; anything after
 * that overlap is new. No overlap ⇒ treat the whole current window as new and
 * mark `wrapped` (caller may increment a wrap counter for honest UI).
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
