import { normalizePlanSummary } from '../lib/plan-summary'
import { isRecord } from '../lib/is-record'
import { equalityFieldsOfFilter, shapeOfFilter, shapeOfPipeline } from './shape'
import type { SlowQueryAttr } from './types'

/**
 * Extract typed slow-query fields from a MongoDB log `attr` object.
 * Returns null when required fields are missing.
 */
export function extractSlowQueryAttr(attr: unknown): SlowQueryAttr | null {
  if (!isRecord(attr)) {
    return null
  }
  const a = attr

  const namespace = typeof a.ns === 'string' ? a.ns : ''
  if (!namespace) {
    return null
  }

  const command = isRecord(a.command) ? a.command : null

  const op = resolveOp(command, a.type)
  const { shape, filterDisplay, equalityFields } = resolveShape(op, command, a)

  const durationMs = numberOrZero(a.durationMillis)
  const docsExamined = numberOrZero(a.docsExamined ?? a.keysExamined)
  const docsReturned = numberOrZero(a.nreturned ?? a.nReturned)
  const plan = normalizePlanSummary(a.planSummary)

  return {
    namespace,
    op,
    shape,
    durationMs,
    docsExamined,
    docsReturned,
    plan,
    filterDisplay,
    equalityFields,
  }
}

function resolveOp(command: Record<string, unknown> | null, type: unknown): string {
  if (command) {
    for (const key of Object.keys(command)) {
      // Skip meta keys that aren't the operation name
      if (
        key === 'filter' ||
        key === 'sort' ||
        key === 'projection' ||
        key === 'limit' ||
        key === 'skip' ||
        key === 'pipeline' ||
        key === 'cursor' ||
        key === 'lsid' ||
        key === '$db' ||
        key === '$clusterTime' ||
        key === 'writeConcern' ||
        key === 'updates' ||
        key === 'deletes' ||
        key === 'ordered' ||
        key === 'documents'
      ) {
        continue
      }
      return key
    }
  }
  if (typeof type === 'string' && type.length > 0) {
    return type
  }
  return 'unknown'
}

function resolveShape(
  op: string,
  command: Record<string, unknown> | null,
  attr: Record<string, unknown>,
): { shape: string; filterDisplay: string; equalityFields: string[] } {
  if (op === 'aggregate') {
    const pipeline = command?.pipeline ?? attr.pipeline
    const shape = shapeOfPipeline(pipeline)
    return {
      shape,
      filterDisplay: formatJson(pipeline) ?? 'n/a',
      equalityFields: equalityFieldsFromPipeline(pipeline),
    }
  }

  if (op === 'insert') {
    return { shape: 'n/a', filterDisplay: 'n/a', equalityFields: [] }
  }

  const filter = findFilter(op, command, attr)
  if (filter === undefined) {
    return { shape: 'n/a', filterDisplay: 'n/a', equalityFields: [] }
  }

  return {
    shape: shapeOfFilter(filter),
    filterDisplay: formatJson(filter) ?? 'n/a',
    equalityFields: equalityFieldsOfFilter(filter),
  }
}

function findFilter(
  op: string,
  command: Record<string, unknown> | null,
  attr: Record<string, unknown>,
): unknown {
  if (command) {
    if (command.filter !== undefined) {
      return command.filter
    }
    if (command.query !== undefined) {
      return command.query
    }
    if (command.q !== undefined) {
      return command.q
    }

    if (op === 'update' && Array.isArray(command.updates) && command.updates[0]) {
      const first = command.updates[0]
      if (isRecord(first) && first.q !== undefined) {
        return first.q
      }
    }

    if (op === 'delete' && Array.isArray(command.deletes) && command.deletes[0]) {
      const first = command.deletes[0]
      if (isRecord(first) && first.q !== undefined) {
        return first.q
      }
    }
  }

  if (attr.filter !== undefined) {
    return attr.filter
  }
  if (attr.query !== undefined) {
    return attr.query
  }
  return undefined
}

function equalityFieldsFromPipeline(pipeline: unknown): string[] {
  if (!Array.isArray(pipeline)) {
    return []
  }
  for (const stage of pipeline) {
    if (!isRecord(stage)) {
      continue
    }
    const match = stage['$match']
    if (match !== undefined) {
      return equalityFieldsOfFilter(match)
    }
  }
  return []
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function formatJson(value: unknown): string | null {
  if (value === undefined) {
    return null
  }
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

export function splitNamespace(ns: string): { db: string; collection: string } {
  const dot = ns.indexOf('.')
  if (dot <= 0) {
    return { db: ns, collection: ns }
  }
  return { db: ns.slice(0, dot), collection: ns.slice(dot + 1) }
}
