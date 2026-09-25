import { isRecord } from '../lib/is-record'
import { normalizePlanSummary } from '../lib/plan-summary'
import { formatJson } from './attr'
import type { PatternExplain } from './types'

const COMMAND_STRIP_KEYS = new Set([
  'lsid',
  '$clusterTime',
  '$configTime',
  '$topologyTime',
  '$client',
  '$db',
])

export function stageDetailFor(plan: string, attr?: unknown): string {
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

export function extractWorkMetrics(
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

export function cleanCommandDisplay(command: unknown): string {
  if (command === undefined) {
    return 'n/a'
  }
  if (!isRecord(command)) {
    return prettyJson(command) ?? formatJson(command) ?? 'n/a'
  }

  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(command)) {
    if (COMMAND_STRIP_KEYS.has(key)) {
      continue
    }
    cleaned[key] = value
  }
  return prettyJson(cleaned) ?? 'n/a'
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function prettyJson(value: unknown): string | null {
  if (value === undefined) {
    return null
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return null
  }
}
