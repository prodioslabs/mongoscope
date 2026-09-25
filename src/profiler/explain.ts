import {
  extractSlowQueryAttr,
  suggestIndex,
  type PatternExplain,
  type QueryPattern,
} from '../query-patterns'
import {
  cleanCommandDisplay,
  extractWorkMetrics,
  prettyJson,
  stageDetailFor,
  stringOrNull,
} from '../query-patterns/explain-shared'
import { profileDocToAttr } from './profile-doc'

/**
 * Build PatternExplain from an in-memory system.profile sample document.
 */
export function getPatternExplainFromSample(
  pattern: QueryPattern,
  sampleDoc: Record<string, unknown>,
): PatternExplain {
  const attr = profileDocToAttr(sampleDoc) ?? sampleDoc
  const extracted = extractSlowQueryAttr(attr)
  const context = extractContext(attr, sampleDoc)
  const work = extractWorkMetrics(attr)
  const commandDisplay = cleanCommandDisplay(attr?.command)
  const rawDisplay = prettyJson(sampleDoc) ?? String(sampleDoc)
  const planSummary = stringOrNull(attr?.planSummary)

  if (extracted == null) {
    return {
      namespace: pattern.namespace,
      op: pattern.op,
      plan: pattern.plan,
      planSummary,
      filter: 'n/a',
      docsExamined: pattern.avgDocsExamined,
      nReturned: pattern.avgDocsReturned,
      totalMillis: pattern.avgMs,
      stageDetail: stageDetailFor(pattern.plan, attr),
      suggestedIndex: null,
      ...context,
      ...work,
      commandDisplay,
      rawDisplay,
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
    op: extracted.op,
    plan,
    planSummary,
    filter: extracted.filterDisplay,
    docsExamined: extracted.docsExamined,
    nReturned: extracted.docsReturned,
    totalMillis: extracted.durationMs,
    stageDetail: stageDetailFor(plan, attr),
    suggestedIndex,
    ...context,
    ...work,
    commandDisplay,
    rawDisplay,
  }
}

function extractContext(
  attr: Record<string, unknown> | null,
  sampleDoc: Record<string, unknown>,
): Pick<PatternExplain, 'timestampMs' | 'ctx' | 'appName' | 'remote' | 'protocol'> {
  let timestampMs = Number.NaN
  const ts = sampleDoc.ts
  if (ts instanceof Date) {
    timestampMs = ts.getTime()
  } else if (typeof ts === 'number' && Number.isFinite(ts)) {
    timestampMs = ts
  }

  return {
    timestampMs,
    ctx: typeof sampleDoc.user === 'string' ? sampleDoc.user : '',
    appName: stringOrNull(attr?.appName) ?? stringOrNull(sampleDoc.appName),
    remote: stringOrNull(attr?.remote) ?? stringOrNull(sampleDoc.client),
    protocol: stringOrNull(attr?.protocol) ?? stringOrNull(sampleDoc.protocol),
  }
}
