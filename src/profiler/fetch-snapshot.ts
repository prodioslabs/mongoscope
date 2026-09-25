import type { MongoDbClient } from '../live-connection'
import { isRecord } from '../lib/is-record'
import {
  filterPickerDatabases,
  parseListDatabasesResult,
} from '../indexes/normalize'
import { buildPatternsFromSamples } from './build-patterns'
import {
  databasesErrorFromUnknown,
  isNamespaceMissing,
  isProfilerUnavailableOnMongos,
  readErrorFromUnknown,
  statusErrorFromUnknown,
} from './permissions'
import { toProfileSample } from './profile-doc'
import {
  DEFAULT_SLOWMS,
  PROFILE_FETCH_LIMIT,
  type ProfilerSlowQueriesSnapshot,
  type ProfilingStatus,
} from './types'

export type ProfilerClient = MongoDbClient

export type FetchProfilerSnapshotResult = {
  snapshot: ProfilerSlowQueriesSnapshot
}

/**
 * Fetch listDatabases + profiling status + newest system.profile docs for one DB.
 */
export async function fetchProfilerSlowQueriesSnapshot(
  client: ProfilerClient,
  selectedDatabase: string | null,
  options?: { limit?: number },
): Promise<FetchProfilerSnapshotResult> {
  const fetchLimit = Math.max(
    1,
    Math.floor(options?.limit ?? PROFILE_FETCH_LIMIT),
  )
  const databasesResult = await settle(async function loadDatabases() {
    return client.db('admin').admin().command({ listDatabases: 1, nameOnly: true })
  })

  let databases: string[] = []
  let databasesError: ProfilerSlowQueriesSnapshot['errors']['databases'] = null
  if (databasesResult.status === 'fulfilled') {
    databases = filterPickerDatabases(parseListDatabasesResult(databasesResult.value))
  } else {
    databasesError = databasesErrorFromUnknown(databasesResult.reason)
  }

  const database =
    selectedDatabase != null && selectedDatabase.trim() !== ''
      ? selectedDatabase
      : (databases[0] ?? '')

  if (database === '') {
    return {
      snapshot: emptySnapshot('', databases, {
        databases: databasesError,
        status: null,
        read: null,
        topology: null,
      }),
    }
  }

  const db = client.db(database)
  const [statusResult, docsResult] = await Promise.all([
    settle(async function loadProfilingStatus() {
      return db.command({ profile: -1 })
    }),
    settle(async function loadProfileDocs() {
      return db
        .collection('system.profile')
        .find({})
        .sort({ ts: -1 })
        .limit(fetchLimit)
        .toArray()
    }),
  ])

  let topologyError: ProfilerSlowQueriesSnapshot['errors']['topology'] = null
  let statusError: ProfilerSlowQueriesSnapshot['errors']['status'] = null
  let profiling: ProfilingStatus | null = null

  if (statusResult.status === 'fulfilled') {
    profiling = parseProfilingStatus(statusResult.value)
  } else {
    if (isProfilerUnavailableOnMongos(statusResult.reason)) {
      topologyError = {
        kind: 'unavailable',
        message: 'profiler unavailable on mongos',
      }
    } else {
      statusError = statusErrorFromUnknown(statusResult.reason)
    }
  }

  let readError: ProfilerSlowQueriesSnapshot['errors']['read'] = null
  let rawDocs: unknown[] = []
  if (docsResult.status === 'fulfilled') {
    rawDocs = Array.isArray(docsResult.value) ? docsResult.value : []
  } else if (isNamespaceMissing(docsResult.reason)) {
    rawDocs = []
  } else {
    readError = readErrorFromUnknown(docsResult.reason)
  }

  const profileSamples = []
  for (const doc of rawDocs) {
    const sample = toProfileSample(doc)
    if (sample != null) {
      profileSamples.push(sample)
    }
  }

  const built = buildPatternsFromSamples(profileSamples)

  return {
    snapshot: {
      database,
      databases,
      profiling,
      patterns: built.patterns,
      samples: built.samples,
      windowStartMs: built.windowStartMs,
      windowEndMs: built.windowEndMs,
      slowQueryCount: built.slowQueryCount,
      errors: {
        databases: databasesError,
        status: statusError,
        read: readError,
        topology: topologyError,
      },
    },
  }
}

/**
 * Parse `profile: -1` / getProfilingStatus result.
 * MongoDB returns `{ was: <level>, slowms, ok: 1 }`.
 */
export function parseProfilingStatus(raw: unknown): ProfilingStatus | null {
  if (!isRecord(raw)) {
    return null
  }
  const record = raw
  const levelValue =
    typeof record.was === 'number' && Number.isFinite(record.was)
      ? record.was
      : typeof record.level === 'number' && Number.isFinite(record.level)
        ? record.level
        : null
  if (levelValue == null) {
    return null
  }
  const slowms =
    typeof record.slowms === 'number' && Number.isFinite(record.slowms)
      ? record.slowms
      : DEFAULT_SLOWMS
  return { level: levelValue, slowms }
}

function emptySnapshot(
  database: string,
  databases: string[],
  errors: ProfilerSlowQueriesSnapshot['errors'],
): ProfilerSlowQueriesSnapshot {
  return {
    database,
    databases,
    profiling: null,
    patterns: [],
    samples: [],
    windowStartMs: 0,
    windowEndMs: 0,
    slowQueryCount: 0,
    errors,
  }
}

async function settle<T>(fn: () => Promise<T>): Promise<PromiseSettledResult<T>> {
  try {
    return { status: 'fulfilled', value: await fn() }
  } catch (reason) {
    return { status: 'rejected', reason }
  }
}
