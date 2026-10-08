export type ScrollThumbMetrics = {
  /** False when content fits the viewport — no indicator (matches OpenTUI ScrollBar / welcome-screen). */
  visible: boolean
  /** Track height used for thumbSize/thumbOffset (usually the viewport row count). */
  trackRows: number
  /** Thumb height in track rows, in `[1, trackRows]` when visible. */
  thumbSize: number
  /** Thumb top offset in track rows, in `[0, trackRows - thumbSize]` when visible. */
  thumbOffset: number
}

/**
 * Pure vertical scroll-thumb geometry.
 *
 * OpenTUI's built-in ScrollBox thumb is wrong for typical dialog sizes: Slider.viewPortSize
 * clamps to the scroll *range* (`max - min`) and can stick at `0.01` after a fit→overflow
 * layout, so the thumb stays far too small. Use this instead of the built-in indicator.
 */
export function scrollThumbMetrics(
  contentRows: number,
  viewportRows: number,
  scrollOffset: number,
  trackRows: number = viewportRows,
): ScrollThumbMetrics {
  const content = Number.isFinite(contentRows) ? Math.max(0, Math.floor(contentRows)) : 0
  const viewport = Number.isFinite(viewportRows) ? Math.max(0, Math.floor(viewportRows)) : 0
  const track = Number.isFinite(trackRows) ? Math.max(0, Math.floor(trackRows)) : 0

  if (track <= 0 || viewport <= 0 || content <= viewport) {
    return { visible: false, trackRows: track, thumbSize: track, thumbOffset: 0 }
  }

  const thumbSize = Math.max(1, Math.min(track, Math.round((viewport / content) * track)))
  const maxScroll = content - viewport
  const clampedOffset = Number.isFinite(scrollOffset)
    ? Math.max(0, Math.min(maxScroll, Math.floor(scrollOffset)))
    : 0
  const maxThumbOffset = track - thumbSize
  const thumbOffset =
    maxScroll === 0 ? 0 : Math.round((clampedOffset / maxScroll) * maxThumbOffset)

  return {
    visible: true,
    trackRows: track,
    thumbSize,
    thumbOffset: Math.max(0, Math.min(maxThumbOffset, thumbOffset)),
  }
}
