export type IndexBuildProgress = {
  database: string
  collection: string
  indexName: string
  percent: number | null
  message: string | null
}

export type IndexBuildProgressByKey = Map<string, IndexBuildProgress>

/** Join key used when merging `$currentOp` builds onto inventory rows. */
export function indexBuildKey(database: string, collection: string, indexName: string): string {
  return `${database}.${collection}::${indexName}`
}

/**
 * Normalize `$currentOp` docs for active / idle index builds into a map keyed
 * by {@link indexBuildKey}.
 */
export function parseIndexBuildOps(docs: unknown[]): IndexBuildProgressByKey {
  const byKey: IndexBuildProgressByKey = new Map()

  for (const doc of docs) {
    if (doc == null || typeof doc !== 'object') {
      continue
    }
    const record = doc as Record<string, unknown>
    if (!isIndexBuildOp(record)) {
      continue
    }

    const percent = extractBuildPercent(record)
    const message = typeof record.msg === 'string' && record.msg.trim() !== '' ? record.msg : null
    const targets = extractBuildTargets(record)

    for (const target of targets) {
      const key = indexBuildKey(target.database, target.collection, target.indexName)
      const previous = byKey.get(key)
      // Prefer an entry that already has a percent when duplicates appear.
      if (previous != null && previous.percent != null && percent == null) {
        continue
      }
      byKey.set(key, {
        database: target.database,
        collection: target.collection,
        indexName: target.indexName,
        percent,
        message,
      })
    }
  }

  return byKey
}

function isIndexBuildOp(record: Record<string, unknown>): boolean {
  const op = record.op
  const msg = typeof record.msg === 'string' ? record.msg : ''
  const command = record.command

  if (op === 'command' && command != null && typeof command === 'object') {
    if ('createIndexes' in (command as Record<string, unknown>)) {
      return true
    }
  }

  if ((op === 'none' || op === 'command') && /^Index Build/i.test(msg)) {
    return true
  }

  return false
}

function extractBuildPercent(record: Record<string, unknown>): number | null {
  const progress = record.progress
  if (progress != null && typeof progress === 'object') {
    const done = toFiniteNumber((progress as { done?: unknown }).done)
    const total = toFiniteNumber((progress as { total?: unknown }).total)
    if (done != null && total != null && total > 0) {
      return clampPercent((done / total) * 100)
    }
  }

  if (typeof record.msg === 'string') {
    const match = record.msg.match(/(\d+(?:\.\d+)?)\s*%/)
    if (match?.[1] != null) {
      return clampPercent(Number(match[1]))
    }
  }

  return null
}

function extractBuildTargets(
  record: Record<string, unknown>,
): Array<{ database: string; collection: string; indexName: string }> {
  const ns = typeof record.ns === 'string' ? record.ns : null
  const parsedNs = ns != null ? splitNamespace(ns) : null
  const command = record.command

  if (command != null && typeof command === 'object') {
    const cmd = command as Record<string, unknown>
    const collectionFromCommand =
      typeof cmd.createIndexes === 'string' && cmd.createIndexes.trim() !== ''
        ? cmd.createIndexes
        : null
    const database =
      parsedNs?.database ??
      (typeof cmd.$db === 'string' && cmd.$db.trim() !== '' ? cmd.$db : null)
    const collection = collectionFromCommand ?? parsedNs?.collection ?? null

    if (database != null && collection != null && Array.isArray(cmd.indexes)) {
      const targets: Array<{ database: string; collection: string; indexName: string }> = []
      for (const indexSpec of cmd.indexes) {
        if (indexSpec == null || typeof indexSpec !== 'object') {
          continue
        }
        const name = (indexSpec as { name?: unknown }).name
        if (typeof name === 'string' && name.trim() !== '') {
          targets.push({ database, collection, indexName: name })
        }
      }
      if (targets.length > 0) {
        return targets
      }
    }
  }

  if (parsedNs == null) {
    return []
  }

  const indexName = parseIndexNameFromMessage(
    typeof record.msg === 'string' ? record.msg : '',
  )
  if (indexName == null) {
    return []
  }

  return [
    {
      database: parsedNs.database,
      collection: parsedNs.collection,
      indexName,
    },
  ]
}

function splitNamespace(ns: string): { database: string; collection: string } | null {
  const dot = ns.indexOf('.')
  if (dot <= 0 || dot >= ns.length - 1) {
    return null
  }
  return {
    database: ns.slice(0, dot),
    collection: ns.slice(dot + 1),
  }
}

/** Best-effort: `Index Build: name_1` or quoted name in msg. */
function parseIndexNameFromMessage(msg: string): string | null {
  const named = msg.match(/Index Build[:\s]+(?:index\s+)?['"]?([A-Za-z0-9_.:-]+)['"]?/i)
  if (named?.[1] != null && named[1].toLowerCase() !== 'build') {
    return named[1]
  }
  return null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'bigint') {
    return Number(value)
  }
  if (
    value != null &&
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber: unknown }).toNumber === 'function'
  ) {
    const converted = (value as { toNumber: () => number }).toNumber()
    return Number.isFinite(converted) ? converted : null
  }
  return null
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10))
}
