import { readEntryDetail, type LogStore } from '../parser'
import { extractSlowQueryAttr, normalizePlanSummary } from './attr'
import { suggestIndex } from './suggest-index'
import type { PatternExplain, QueryPatternStore } from './types'

/**
 * Build an explain payload for a pattern using its slowest sample row.
 */
export async function getPatternExplain(
  logStore: LogStore,
  patterns: QueryPatternStore,
  patternId: number,
): Promise<PatternExplain> {
  const pattern = patterns.patterns.find((p) => p.id === patternId)
  if (pattern == null) {
    throw new RangeError(`pattern id ${patternId} not found`)
  }

  const detail = await readEntryDetail(logStore, pattern.sampleRow)
  const extracted = extractSlowQueryAttr(detail.attr)

  if (extracted == null) {
    return {
      namespace: pattern.namespace,
      plan: pattern.plan,
      filter: 'n/a',
      docsExamined: pattern.avgDocsExamined,
      nReturned: pattern.avgDocsReturned,
      totalMillis: pattern.avgMs,
      stageDetail: stageDetailFor(pattern.plan),
      suggestedIndex: null,
    }
  }

  const plan = extracted.plan !== 'n/a' ? extracted.plan : pattern.plan
  const suggestedIndex = suggestIndex({
    namespace: extracted.namespace,
    plan,
    equalityFields: extracted.equalityFields,
    docsExamined: extracted.docsExamined,
    nReturned: extracted.docsReturned,
  })

  return {
    namespace: extracted.namespace,
    plan,
    filter: extracted.filterDisplay,
    docsExamined: extracted.docsExamined,
    nReturned: extracted.docsReturned,
    totalMillis: extracted.durationMs,
    stageDetail: stageDetailFor(plan, detail.attr),
    suggestedIndex,
  }
}

function stageDetailFor(plan: string, attr?: unknown): string {
  if (plan === 'COLLSCAN') {
    return 'executionStages.stage: COLLSCAN (no index used)'
  }
  if (plan === 'IXSCAN+SORT') {
    return 'executionStages.stage: IXSCAN + SORT'
  }
  if (plan === 'IXSCAN') {
    const raw =
      attr !== null && typeof attr === 'object' && !Array.isArray(attr)
        ? (attr as Record<string, unknown>).planSummary
        : undefined
    const summary = typeof raw === 'string' ? raw : 'IXSCAN'
    return `executionStages.stage: ${summary}`
  }
  if (plan === 'n/a') {
    return 'executionStages.stage: n/a'
  }
  return `executionStages.stage: ${normalizePlanSummary(plan)}`
}
