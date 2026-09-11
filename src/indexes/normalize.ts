import { formatIndexKey } from './format'
import type { IndexOptionFlag, IndexRow } from './types'

export const SYSTEM_DATABASE_NAMES = new Set(['admin', 'local', 'config'])

export function filterPickerDatabases(names: string[]): string[] {
  return names.filter(function keepUserDatabase(name) {
    return name.trim() !== '' && !SYSTEM_DATABASE_NAMES.has(name)
  })
}

export function parseListDatabasesResult(raw: unknown): string[] {
  if (raw == null || typeof raw !== 'object') {
    return []
  }
  const databases = (raw as { databases?: unknown }).databases
  if (!Array.isArray(databases)) {
    return []
  }
  const names: string[] = []
  for (const entry of databases) {
    if (entry == null || typeof entry !== 'object') {
      continue
    }
    const name = (entry as { name?: unknown }).name
    if (typeof name === 'string' && name.trim() !== '') {
      names.push(name)
    }
  }
  return names
}

export function parseListCollectionsResult(raw: unknown): string[] {
  const cursorFirstBatch = extractCursorBatch(raw)
  const source = cursorFirstBatch ?? (Array.isArray(raw) ? raw : null)
  if (source == null) {
    return []
  }

  const names: string[] = []
  for (const entry of source) {
    if (entry == null || typeof entry !== 'object') {
      continue
    }
    const name = (entry as { name?: unknown }).name
    if (typeof name !== 'string' || name.trim() === '') {
      continue
    }
    if (name.startsWith('system.')) {
      continue
    }
    names.push(name)
  }
  return names
}

function extractCursorBatch(raw: unknown): unknown[] | null {
  if (raw == null || typeof raw !== 'object') {
    return null
  }
  const cursor = (raw as { cursor?: unknown }).cursor
  if (cursor == null || typeof cursor !== 'object') {
    return null
  }
  const firstBatch = (cursor as { firstBatch?: unknown }).firstBatch
  return Array.isArray(firstBatch) ? firstBatch : null
}

export function extractIndexFlags(spec: Record<string, unknown>): IndexOptionFlag[] {
  const flags: IndexOptionFlag[] = []
  if (spec.unique === true) {
    flags.push('unique')
  }
  if (spec.sparse === true) {
    flags.push('sparse')
  }
  if (spec.partialFilterExpression != null) {
    flags.push('partial')
  }
  if (typeof spec.expireAfterSeconds === 'number') {
    flags.push('ttl')
  }
  if (spec.hidden === true) {
    flags.push('hidden')
  }

  const key = spec.key
  if (key != null && typeof key === 'object' && !Array.isArray(key)) {
    const values = Object.values(key as Record<string, unknown>)
    if (values.includes('text')) {
      flags.push('text')
    }
    if (values.includes('2dsphere')) {
      flags.push('2dsphere')
    }
    if (values.includes('2d')) {
      flags.push('2d')
    }
    if (values.includes('hashed')) {
      flags.push('hashed')
    }
  }

  return flags
}

export type IndexUsageByName = Map<
  string,
  {
    ops: number | null
    since: Date | null
  }
>

export function parseIndexStatsDocs(docs: unknown[]): IndexUsageByName {
  const byName: IndexUsageByName = new Map()
  for (const doc of docs) {
    if (doc == null || typeof doc !== 'object') {
      continue
    }
    const record = doc as {
      name?: unknown
      accesses?: { ops?: unknown; since?: unknown }
    }
    if (typeof record.name !== 'string' || record.name.trim() === '') {
      continue
    }
    const opsRaw = record.accesses?.ops
    const sinceRaw = record.accesses?.since
    byName.set(record.name, {
      ops: typeof opsRaw === 'number' && Number.isFinite(opsRaw) ? opsRaw : null,
      since: toDate(sinceRaw),
    })
  }
  return byName
}

export function parseCollStatsIndexSizes(raw: unknown): {
  indexSizes: Record<string, number>
  totalIndexSizeBytes: number | null
} {
  if (raw == null || typeof raw !== 'object') {
    return { indexSizes: {}, totalIndexSizeBytes: null }
  }
  const record = raw as { indexSizes?: unknown; totalIndexSize?: unknown }
  const indexSizes: Record<string, number> = {}
  if (record.indexSizes != null && typeof record.indexSizes === 'object') {
    for (const [name, size] of Object.entries(record.indexSizes as Record<string, unknown>)) {
      if (typeof size === 'number' && Number.isFinite(size)) {
        indexSizes[name] = size
      }
    }
  }
  const total =
    typeof record.totalIndexSize === 'number' && Number.isFinite(record.totalIndexSize)
      ? record.totalIndexSize
      : null
  return { indexSizes, totalIndexSizeBytes: total }
}

export function normalizeIndexSpecs(
  specs: unknown[],
  indexSizes: Record<string, number>,
  usageByName: IndexUsageByName | null,
): IndexRow[] {
  const rows: IndexRow[] = []
  for (const spec of specs) {
    if (spec == null || typeof spec !== 'object') {
      continue
    }
    const record = spec as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name : null
    if (name == null || name.trim() === '') {
      continue
    }
    const usage = usageByName?.get(name) ?? null
    rows.push({
      name,
      keyLabel: formatIndexKey(record.key),
      flags: extractIndexFlags(record),
      sizeBytes: indexSizes[name] ?? null,
      ops: usage?.ops ?? null,
      since: usage?.since ?? null,
    })
  }
  return rows
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}
