import {
  extractSlowQueryAttr,
  formatJson,
  normalizePlanSummary,
  suggestIndex,
  type PatternExplain,
  type QueryPattern,
} from '../query-patterns'
import { profileDocToAttr } from './profile-doc'

const COMMAND_STRIP_KEYS = new Set([
  'lsid',
  '$clusterTime',
  '$configTime',
  '$topologyTime',
  '$client',
  '$db',
])

/**
 * Build PatternExplain from an in-memory system.profile sample document.
 */
export function getPatternExplainFromSample(
  pattern: QueryPattern,
  sampleDoc: unknown,
): PatternExplain {
  const attr = profileDocToAttr(sampleDoc) ?? asRecord(sampleDoc)
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

function stageDetailFor(plan: string, attr?: Record<string, unknown> | null): string {
  if (plan === 'COLLSCAN') {
    return 'executionStages.stage: COLLSCAN (no index used)'
  }
  if (plan === 'IXSCAN+SORT') {
    return 'executionStages.stage: IXSCAN + SORT'
  }
  if (plan === 'IXSCAN') {
    const raw = attr?.planSummary
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
  sampleDoc: unknown,
): Pick<PatternExplain, 'timestampMs' | 'ctx' | 'appName' | 'remote' | 'protocol'> {
  const doc = asRecord(sampleDoc)
  let timestampMs = Number.NaN
  const ts = doc?.ts
  if (ts instanceof Date) {
    timestampMs = ts.getTime()
  } else if (typeof ts === 'number' && Number.isFinite(ts)) {
    timestampMs = ts
  }

  return {
    timestampMs,
    ctx: typeof doc?.user === 'string' ? doc.user : '',
    appName: stringOrNull(attr?.appName) ?? stringOrNull(doc?.appName),
    remote: stringOrNull(attr?.remote) ?? stringOrNull(doc?.client),
    protocol: stringOrNull(attr?.protocol) ?? stringOrNull(doc?.protocol),
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
  if (command === undefined) {
    return 'n/a'
  }
  if (command === null || typeof command !== 'object' || Array.isArray(command)) {
    return prettyJson(command) ?? formatJson(command) ?? 'n/a'
  }

  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(command as Record<string, unknown>)) {
    if (COMMAND_STRIP_KEYS.has(key)) {
      continue
    }
    cleaned[key] = value
  }
  return prettyJson(cleaned) ?? 'n/a'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function prettyJson(value: unknown): string | null {
  if (value === undefined) {
    return null
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return null
  }
}
