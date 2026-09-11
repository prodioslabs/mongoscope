import type { CollectionLike, MongoClientLike } from '../live-connection'
import {
  filterPickerDatabases,
  normalizeIndexSpecs,
  parseCollStatsIndexSizes,
  parseIndexStatsDocs,
  parseListCollectionsResult,
  parseListDatabasesResult,
} from './normalize'
import { panelErrorFromUnknown } from './panel-error'
import type { CollectionIndexes, IndexesSnapshot } from './types'

export type IndexesClient = Pick<MongoClientLike, 'db'>

export type FetchIndexesSnapshotResult = {
  snapshot: IndexesSnapshot
}

const COLLECTION_FETCH_CONCURRENCY = 5

/**
 * Fetch database list (always) and, when `selectedDatabase` is set, collection
 * index inventory with sizes + usage. Per-collection failures are isolated.
 */
export async function fetchIndexesSnapshot(
  client: IndexesClient,
  selectedDatabase: string | null,
): Promise<FetchIndexesSnapshotResult> {
  const databasesResult = await settle(async function loadDatabases() {
    return client.db('admin').admin().command({ listDatabases: 1, nameOnly: true })
  })

  const errors: IndexesSnapshot['errors'] = {
    databases: null,
    collections: null,
  }

  let databases: string[] = []
  if (databasesResult.status === 'fulfilled') {
    databases = filterPickerDatabases(parseListDatabasesResult(databasesResult.value))
  } else {
    errors.databases = panelErrorFromUnknown(databasesResult.reason, 'failed to list databases')
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
      return fetchCollectionIndexes(client, selectedDatabase, name)
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
    indexes: normalizeIndexSpecs(indexesResult.value, indexSizes, usageByName),
    error: null,
    usageUnavailable,
  }
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
  const results = new Array<R>(items.length)
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
