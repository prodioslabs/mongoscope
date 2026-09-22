const FULL_BLOCK = '█'
const TRACK_EMPTY = ' '
const PARTIAL_BLOCKS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const

/**
 * Fixed-width horizontal fill bar (0–100%).
 * Uses partial-block Unicode for sub-column resolution within each character cell.
 */
export function horizontalBarString(
  percent: number,
  trackWidth: number,
  emptyChar: string = TRACK_EMPTY,
): string {
  const safeWidth = Math.max(0, Math.floor(trackWidth))
  if (safeWidth === 0) {
    return ''
  }
  const clampedPercent = Math.max(0, Math.min(100, percent))
  const filled = (clampedPercent / 100) * safeWidth
  const fullBlocks = Math.floor(filled)
  const remainder = filled - fullBlocks
  const partialIndex = Math.round(remainder * 8)
  const partialChar = PARTIAL_BLOCKS[Math.min(8, Math.max(0, partialIndex))] ?? ''
  const emptyCount = safeWidth - fullBlocks - (partialChar === '' ? 0 : 1)
  return FULL_BLOCK.repeat(fullBlocks) + partialChar + emptyChar.repeat(Math.max(0, emptyCount))
}
