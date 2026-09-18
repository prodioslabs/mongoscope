import type { QueryPattern } from './types'

export type LiveOpPatternMatch = {
  namespace: string
  op: string
  plan: string
}

/**
 * Find the best matching slow-query pattern for a live currentOp row.
 * Scoring: namespace+op+plan (highest count) → namespace+op → no match.
 */
export function findBestMatchingPattern(
  patterns: QueryPattern[],
  match: LiveOpPatternMatch,
): QueryPattern | null {
  if (patterns.length === 0) {
    return null
  }

  const namespace = normalizeNamespace(match.namespace)
  const op = match.op.trim().toLowerCase()
  const plan = match.plan.trim()

  const exactPlanMatches = patterns.filter(function matchesExactPlan(pattern) {
    return (
      normalizeNamespace(pattern.namespace) === namespace &&
      pattern.op.trim().toLowerCase() === op &&
      pattern.plan === plan
    )
  })
  if (exactPlanMatches.length > 0) {
    return pickHighestCount(exactPlanMatches)
  }

  const opMatches = patterns.filter(function matchesOp(pattern) {
    return (
      normalizeNamespace(pattern.namespace) === namespace && pattern.op.trim().toLowerCase() === op
    )
  })
  if (opMatches.length > 0) {
    return pickHighestCount(opMatches)
  }

  return null
}

function normalizeNamespace(namespace: string): string {
  if (namespace === '—') {
    return ''
  }
  return namespace.trim()
}

function pickHighestCount(candidates: QueryPattern[]): QueryPattern {
  let best = candidates[0]!
  for (const candidate of candidates) {
    if (candidate.count > best.count) {
      best = candidate
    }
  }
  return best
}
