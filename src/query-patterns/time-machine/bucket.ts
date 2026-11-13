import { TREND_BUCKETS } from '../types'

/** Map a timestamp into a trend bucket index over `[windowStartMs, windowEndMs]`. */
export function bucketIndexForTimestamp(
  timestampMs: number,
  windowStartMs: number,
  windowEndMs: number,
  bucketCount: number = TREND_BUCKETS,
): number | null {
  if (!Number.isFinite(timestampMs) || bucketCount <= 0) {
    return null
  }
  const span = Math.max(1, windowEndMs - windowStartMs)
  const index = Math.floor(((timestampMs - windowStartMs) / span) * bucketCount)
  if (index < 0) {
    return 0
  }
  if (index >= bucketCount) {
    return bucketCount - 1
  }
  return index
}

/** Average ms per bucket; 0 when the bucket count is 0. */
export function avgMsPerBucket(
  counts: ArrayLike<number>,
  sumDurationMs: ArrayLike<number>,
): Float64Array {
  const length = Math.min(counts.length, sumDurationMs.length)
  const out = new Float64Array(length)
  for (let i = 0; i < length; i++) {
    const count = counts[i] ?? 0
    out[i] = count > 0 ? (sumDurationMs[i] ?? 0) / count : 0
  }
  return out
}

export function modalPlanFromCounts(counts: Map<string, number>): string {
  let best = 'n/a'
  let bestCount = -1
  for (const [plan, n] of counts) {
    if (n > bestCount) {
      best = plan
      bestCount = n
    }
  }
  return best
}

export function planMixFromCounts(
  counts: Map<string, number>,
): ReadonlyArray<{ plan: string; count: number }> {
  const mix: { plan: string; count: number }[] = []
  for (const [plan, count] of counts) {
    mix.push({ plan, count })
  }
  mix.sort(function comparePlanMix(a, b) {
    if (b.count !== a.count) {
      return b.count - a.count
    }
    return a.plan.localeCompare(b.plan)
  })
  return mix
}
