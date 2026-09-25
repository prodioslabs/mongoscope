/** Normalize planSummary to a short UI label (COLLSCAN, IXSCAN, IXSCAN+SORT, …). */
export function normalizePlanSummary(planSummary: unknown): string {
  if (typeof planSummary !== 'string' || planSummary.length === 0) {
    return 'n/a'
  }
  const upper = planSummary.toUpperCase()
  const hasCollscan = upper.includes('COLLSCAN')
  const hasIxscan = upper.includes('IXSCAN')
  const hasSort = upper.includes('SORT')

  if (hasCollscan && !hasIxscan) {
    return 'COLLSCAN'
  }
  if (hasIxscan && hasSort) {
    return 'IXSCAN+SORT'
  }
  if (hasIxscan) {
    return 'IXSCAN'
  }
  if (hasCollscan) {
    return 'COLLSCAN'
  }
  const first = planSummary.split(/[,\s]/)[0] ?? planSummary
  if (first.length > 24) {
    return `${first.slice(0, 21)}…`
  }
  return first
}
