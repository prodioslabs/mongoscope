import { readEntryDetail, type LogStore } from '../parser'
import { extractSlowQueryAttr, formatJson, normalizePlanSummary } from './attr'
import { suggestIndex } from './suggest-index'
import type { PatternExplain, QueryPatternStore } from './types'

/** Meta keys that drown the useful command body in slow-query logs. */
const COMMAND_STRIP_KEYS = new Set([
  'lsid',
  '$clusterTime',
  '$configTime',
  '$topologyTime',
  '$client',
  '$db',
])

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

function stageDetailFor(plan: string, attr?: unknown): string {
  if (plan === 'COLLSCAN') {
    return 'executionStages.stage: COLLSCAN (no index used)'
  }
  if (plan === 'IXSCAN+SORT') {
    return 'executionStages.stage: IXSCAN + SORT'
  }
  if (plan === 'IXSCAN') {
    const raw = asRecord(attr)?.planSummary
    const summary = typeof raw === 'string' ? raw : 'IXSCAN'
    return `executionStages.stage: ${summary}`
  }
  if (plan === 'n/a') {
    return 'executionStages.stage: n/a'
  }
  return `executionStages.stage: ${normalizePlanSummary(plan)}`
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

function extractWorkMetrics(
  attr: Record<string, unknown> | null,
): Pick<
  PatternExplain,
  | 'keysExamined'
  | 'numYields'
  | 'reslen'
  | 'cpuNanos'
  | 'workingMillis'
  | 'waitForWriteConcernDurationMillis'
> {
  return {
    keysExamined: numberOrNull(attr?.keysExamined),
    numYields: numberOrNull(attr?.numYields),
    reslen: numberOrNull(attr?.reslen),
    cpuNanos: numberOrNull(attr?.cpuNanos),
    workingMillis: numberOrNull(attr?.workingMillis),
    waitForWriteConcernDurationMillis: numberOrNull(attr?.waitForWriteConcernDurationMillis),
  }
}

function cleanCommandDisplay(command: unknown): string {
  if (command === undefined) return 'n/a'
  if (command === null || typeof command !== 'object' || Array.isArray(command)) {
    return prettyJson(command) ?? formatJson(command) ?? 'n/a'
  }

  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(command as Record<string, unknown>)) {
    if (COMMAND_STRIP_KEYS.has(key)) continue
    cleaned[key] = value
  }
  return prettyJson(cleaned) ?? 'n/a'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function prettyJson(value: unknown): string | null {
  if (value === undefined) return null
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return null
  }
}
