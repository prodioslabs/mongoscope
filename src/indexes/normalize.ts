import { formatIndexKey } from './format'
import { isRecord } from '../lib/is-record'
import { indexBuildKey, type IndexBuildProgressByKey } from './parse-index-builds'
import type { IndexOptionFlag, IndexRow } from './types'

const SYSTEM_DATABASE_NAMES = new Set(['admin', 'local', 'config'])

export function filterPickerDatabases(names: string[]): string[] {
  return names.filter(function keepUserDatabase(name) {
    return name.trim() !== '' && !SYSTEM_DATABASE_NAMES.has(name)
  })
}

export function parseListDatabasesResult(raw: unknown): string[] {
  if (!isRecord(raw)) {
    return []
  }
  const databases = raw.databases
  if (!Array.isArray(databases)) {
    return []
  }
  const names: string[] = []
  for (const entry of databases) {
    if (!isRecord(entry)) {
      continue
    }
    const name = entry.name
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
    if (!isRecord(entry)) {
      continue
    }
    const name = entry.name
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
  if (!isRecord(raw)) {
    return null
  }
  const cursor = raw.cursor
  if (!isRecord(cursor)) {
    return null
  }
  const firstBatch = cursor.firstBatch
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
  if (isRecord(key)) {
    const values = Object.values(key)
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

type IndexUsageByName = Map<
  string,
  {
    ops: number | null
    since: Date | null
    building: boolean
  }
>

export function parseIndexStatsDocs(docs: unknown[]): IndexUsageByName {
  const byName: IndexUsageByName = new Map()
  for (const doc of docs) {
    if (!isRecord(doc)) {
      continue
    }
    if (typeof doc.name !== 'string' || doc.name.trim() === '') {
      continue
    }
    const accesses = isRecord(doc.accesses) ? doc.accesses : null
    const opsRaw = accesses?.ops
    const sinceRaw = accesses?.since
    byName.set(doc.name, {
      ops: typeof opsRaw === 'number' && Number.isFinite(opsRaw) ? opsRaw : null,
      since: toDate(sinceRaw),
      building: doc.building === true,
    })
  }
  return byName
}

export function parseCollStatsIndexSizes(raw: unknown): {
  indexSizes: Record<string, number>
  totalIndexSizeBytes: number | null
} {
  if (!isRecord(raw)) {
    return { indexSizes: {}, totalIndexSizeBytes: null }
  }
  const indexSizes: Record<string, number> = {}
  if (isRecord(raw.indexSizes)) {
    for (const [name, size] of Object.entries(raw.indexSizes)) {
      if (typeof size === 'number' && Number.isFinite(size)) {
        indexSizes[name] = size
      }
    }
  }
  const total =
    typeof raw.totalIndexSize === 'number' && Number.isFinite(raw.totalIndexSize)
      ? raw.totalIndexSize
      : null
  return { indexSizes, totalIndexSizeBytes: total }
}

export function normalizeIndexSpecs(
  specs: unknown[],
  indexSizes: Record<string, number>,
  usageByName: IndexUsageByName | null,
  options?: {
    database?: string
    collection?: string
    buildsByKey?: IndexBuildProgressByKey | null
  },
): IndexRow[] {
  const database = options?.database ?? null
  const collection = options?.collection ?? null
  const buildsByKey = options?.buildsByKey ?? null
  const rows: IndexRow[] = []

  for (const spec of specs) {
    if (!isRecord(spec)) {
      continue
    }
    const name = typeof spec.name === 'string' ? spec.name : null
    if (name == null || name.trim() === '') {
      continue
    }
    const usage = usageByName?.get(name) ?? null
    const build =
      database != null && collection != null && buildsByKey != null
        ? (buildsByKey.get(indexBuildKey(database, collection, name)) ?? null)
        : null

    rows.push({
      name,
      keyLabel: formatIndexKey(spec.key),
      flags: extractIndexFlags(spec),
      sizeBytes: indexSizes[name] ?? null,
      ops: usage?.ops ?? null,
      since: usage?.since ?? null,
      building: build != null || usage?.building === true,
      buildPercent: build?.percent ?? null,
      buildMessage: build?.message ?? null,
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
