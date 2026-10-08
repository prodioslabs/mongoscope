const SPARK_CHARS = '▁▂▃▄▅▆▇█'

/** Default sparkline width so the TREND column stays narrow in the table. */
const DEFAULT_SPARKLINE_WIDTH = 12

/**
 * Compact a trend bucket array into a plain-text sparkline (no styling).
 */
export function sparkline(
  trend: ArrayLike<number>,
  width: number = DEFAULT_SPARKLINE_WIDTH,
): string {
  if (trend.length === 0 || width <= 0) {
    return ''
  }

  const pooled = new Uint16Array(width)
  for (let i = 0; i < trend.length; i++) {
    const bucket = Math.min(width - 1, Math.floor((i / trend.length) * width))
    const v = trend[i] ?? 0
    if (v > (pooled[bucket] ?? 0)) {
      pooled[bucket] = v
    }
  }

  let max = 0
  for (let i = 0; i < pooled.length; i++) {
    const v = pooled[i] ?? 0
    if (v > max) {
      max = v
    }
  }
  if (max === 0) {
    return SPARK_CHARS[0]!.repeat(width)
  }

  let out = ''
  const last = SPARK_CHARS.length - 1
  for (let i = 0; i < pooled.length; i++) {
    const v = pooled[i] ?? 0
    const idx = Math.min(last, Math.round((v / max) * last))
    out += SPARK_CHARS[idx]!
  }
  return out
}
