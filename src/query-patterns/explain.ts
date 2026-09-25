import { readEntryDetail, type LogStore } from '../parser'
import { extractSlowQueryAttr } from './attr'
import {
  asRecord,
  cleanCommandDisplay,
  extractWorkMetrics,
  prettyJson,
  stageDetailFor,
  stringOrNull,
} from './explain-shared'
import { suggestIndex } from './suggest-index'
import type { PatternExplain, QueryPatternStore } from './types'

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
  const attrRecord = asRecord(detail.attr)
  const extracted = extractSlowQueryAttr(detail.attr)
  const context = extractContext(attrRecord, detail.ctx, detail.timestamp)
  const work = extractWorkMetrics(attrRecord)
  const commandDisplay = cleanCommandDisplay(attrRecord?.command)
  const rawDisplay = prettyJson(detail.raw) ?? String(detail.raw)
  const planSummary = stringOrNull(attrRecord?.planSummary)

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
      stageDetail: stageDetailFor(pattern.plan, detail.attr),
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
    stageDetail: stageDetailFor(plan, detail.attr),
    suggestedIndex,
    ...context,
    ...work,
    commandDisplay,
    rawDisplay,
  }
}

function extractContext(
  attr: Record<string, unknown> | null,
  ctx: string,
  timestampMs: number,
): Pick<PatternExplain, 'timestampMs' | 'ctx' | 'appName' | 'remote' | 'protocol'> {
  return {
    timestampMs,
    ctx,
    appName: stringOrNull(attr?.appName),
    remote: stringOrNull(attr?.remote),
    protocol: stringOrNull(attr?.protocol),
  }
}
