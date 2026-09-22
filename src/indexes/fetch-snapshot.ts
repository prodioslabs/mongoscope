import type { CollectionLike, MongoDbClient } from '../live-connection'
import {
  filterPickerDatabases,
  normalizeIndexSpecs,
  parseCollStatsIndexSizes,
  parseIndexStatsDocs,
  parseListCollectionsResult,
  parseListDatabasesResult,
} from './normalize'
import { panelErrorFromUnknown } from './panel-error'
import { parseIndexBuildOps, type IndexBuildProgressByKey } from './parse-index-builds'
import type { CollectionIndexes, IndexesSnapshot } from './types'

export type IndexesClient = MongoDbClient

export type FetchIndexesSnapshotResult = {
  snapshot: IndexesSnapshot
}

const COLLECTION_FETCH_CONCURRENCY = 5

/**
 * Fetch database list (always) and, when `selectedDatabase` is set, collection
 * index inventory with sizes + usage + in-flight build progress.
 * Per-collection failures are isolated; `$currentOp` builds are fetched once.
 */
export async function fetchIndexesSnapshot(
  client: IndexesClient,
  selectedDatabase: string | null,
): Promise<FetchIndexesSnapshotResult> {
  const [databasesResult, buildsResult] = await Promise.all([
    settle(async function loadDatabases() {
      return client.db('admin').admin().command({ listDatabases: 1, nameOnly: true })
    }),
    settle(async function loadIndexBuilds() {
      return client
        .db('admin')
        .aggregate([
          { $currentOp: { idleConnections: true, allUsers: true } },
          {
            $match: {
              $or: [
                { op: 'command', 'command.createIndexes': { $exists: true } },
                { op: 'none', msg: /^Index Build/ },
              ],
            },
          },
        ])
        .toArray()
    }),
  ])

  const errors: IndexesSnapshot['errors'] = {
    databases: null,
    collections: null,
    builds: null,
  }

  let databases: string[] = []
  if (databasesResult.status === 'fulfilled') {
    databases = filterPickerDatabases(parseListDatabasesResult(databasesResult.value))
  } else {
    errors.databases = panelErrorFromUnknown(databasesResult.reason, 'failed to list databases')
  }

  let buildsByKey: IndexBuildProgressByKey | null = null
  if (buildsResult.status === 'fulfilled') {
    buildsByKey = parseIndexBuildOps(buildsResult.value)
  } else {
    errors.builds = toBuildsPanelError(buildsResult.reason)
  }

  if (selectedDatabase == null || selectedDatabase.trim() === '') {
    return {
      snapshot: {
        databases,
        selectedDatabase: null,
        collections: [],
        errors,
      },
    }
  }

  const collectionsResult = await settle(async function loadCollections() {
    return client.db(selectedDatabase).command({ listCollections: 1, nameOnly: true })
  })

  if (collectionsResult.status === 'rejected') {
    errors.collections = panelErrorFromUnknown(
      collectionsResult.reason,
      'failed to list collections',
    )
    return {
      snapshot: {
        databases,
        selectedDatabase,
        collections: [],
        errors,
      },
    }
  }

  const collectionNames = parseListCollectionsResult(collectionsResult.value)
  const collections = await mapWithConcurrency(
    collectionNames,
    COLLECTION_FETCH_CONCURRENCY,
    async function loadCollectionIndexes(name) {
      return fetchCollectionIndexes(client, selectedDatabase, name, buildsByKey)
    },
  )

  return {
    snapshot: {
      databases,
      selectedDatabase,
      collections,
      errors,
    },
  }
}

async function fetchCollectionIndexes(
  client: IndexesClient,
  databaseName: string,
  collectionName: string,
  buildsByKey: IndexBuildProgressByKey | null,
): Promise<CollectionIndexes> {
  const db = client.db(databaseName)
  const collection: CollectionLike = db.collection(collectionName)

  const [indexesResult, statsResult, usageResult] = await Promise.allSettled([
    collection.indexes(),
    db.command({ collStats: collectionName }),
    collection.aggregate([{ $indexStats: {} }]).toArray(),
  ])

  if (indexesResult.status === 'rejected') {
    return {
      name: collectionName,
      totalIndexSizeBytes: null,
      indexes: [],
      error: panelErrorFromUnknown(indexesResult.reason, 'failed to list indexes'),
      usageUnavailable: false,
    }
  }

  const { indexSizes, totalIndexSizeBytes } =
    statsResult.status === 'fulfilled'
      ? parseCollStatsIndexSizes(statsResult.value)
      : { indexSizes: {}, totalIndexSizeBytes: null }

  const usageUnavailable = usageResult.status === 'rejected'
  const usageByName =
    usageResult.status === 'fulfilled' ? parseIndexStatsDocs(usageResult.value) : null

  return {
    name: collectionName,
    totalIndexSizeBytes,
    indexes: normalizeIndexSpecs(indexesResult.value, indexSizes, usageByName, {
      database: databaseName,
      collection: collectionName,
      buildsByKey,
    }),
    error: null,
    usageUnavailable,
  }
}

function toBuildsPanelError(reason: unknown): IndexesSnapshot['errors']['builds'] {
  const mapped = panelErrorFromUnknown(reason, 'failed to load index builds')
  if (mapped.kind === 'permission') {
    return {
      kind: 'permission',
      message: 'insufficient permissions (needs inprog / clusterMonitor for build progress)',
    }
  }
  return mapped
}

async function settle<T>(fn: () => Promise<T>): Promise<PromiseSettledResult<T>> {
  try {
    return { status: 'fulfilled', value: await fn() }
  } catch (reason) {
    return { status: 'rejected', reason }
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return []
  }
  const results: R[] = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index]!, index)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    function startWorker() {
      return worker()
    },
  )
  await Promise.all(workers)
  return results
}
