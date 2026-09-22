import { describe, expect, it } from 'vitest'
import type { CollectionLike, MongoClientLike, MongoDbLike } from '../live-connection'
import { fetchIndexesSnapshot } from './fetch-snapshot'

type FakeDb = MongoDbLike & {
  name: string
}

function createFakeClient(handlers: {
  listDatabases?: () => Promise<unknown>
  listCollections?: (dbName: string) => Promise<unknown>
  indexes?: (dbName: string, collectionName: string) => Promise<unknown[]>
  collStats?: (dbName: string, collectionName: string) => Promise<unknown>
  indexStats?: (dbName: string, collectionName: string) => Promise<unknown[]>
  currentOpBuilds?: () => Promise<unknown[]>
}): MongoClientLike {
  return {
    async connect() {},
    async close() {},
    db(dbName = 'test') {
      const fakeDb: FakeDb = {
        name: dbName,
        admin() {
          return {
            async command(command) {
              if (command.listDatabases === 1) {
                if (handlers.listDatabases == null) {
                  throw new Error('listDatabases not stubbed')
                }
                return handlers.listDatabases()
              }
              return { ok: 1 }
            },
          }
        },
        async command(command) {
          if (command.listCollections === 1) {
            if (handlers.listCollections == null) {
              throw new Error('listCollections not stubbed')
            }
            return handlers.listCollections(dbName)
          }
          if (typeof command.collStats === 'string') {
            if (handlers.collStats == null) {
              throw new Error('collStats not stubbed')
            }
            return handlers.collStats(dbName, command.collStats)
          }
          return { ok: 1 }
        },
        aggregate(pipeline) {
          return {
            async toArray() {
              if (dbName === 'admin' && pipeline[0] && '$currentOp' in pipeline[0]) {
                if (handlers.currentOpBuilds == null) {
                  return []
                }
                return handlers.currentOpBuilds()
              }
              return []
            },
          }
        },
        collection(name) {
          const collection: CollectionLike = {
            find() {
              return {
                sort() {
                  return this
                },
                limit() {
                  return this
                },
                async toArray() {
                  return []
                },
              }
            },
            async indexes() {
              if (handlers.indexes == null) {
                throw new Error('indexes not stubbed')
              }
              return handlers.indexes(dbName, name)
            },
            aggregate(pipeline) {
              return {
                async toArray() {
                  if (pipeline[0] && '$indexStats' in pipeline[0]) {
                    if (handlers.indexStats == null) {
                      throw new Error('indexStats not stubbed')
                    }
                    return handlers.indexStats(dbName, name)
                  }
                  return []
                },
              }
            },
          }
          return collection
        },
      }
      return fakeDb
    },
  }
}

describe('fetchIndexesSnapshot', () => {
  it('lists filtered databases and loads collection indexes for the selected db', async () => {
    const client = createFakeClient({
      listDatabases: async () => ({
        databases: [{ name: 'admin' }, { name: 'shop' }, { name: 'local' }],
      }),
      listCollections: async () => ({
        cursor: { firstBatch: [{ name: 'orders' }, { name: 'system.profile' }] },
      }),
      indexes: async () => [
        { name: '_id_', key: { _id: 1 } },
        { name: 'status_1', key: { status: 1 }, unique: true },
      ],
      collStats: async () => ({
        indexSizes: { _id_: 100, status_1: 200 },
        totalIndexSize: 300,
      }),
      indexStats: async () => [
        {
          name: 'status_1',
          accesses: { ops: 9, since: new Date('2024-03-01T00:00:00.000Z') },
        },
      ],
    })

    const { snapshot } = await fetchIndexesSnapshot(client, 'shop')

    expect(snapshot.databases).toEqual(['shop'])
    expect(snapshot.selectedDatabase).toBe('shop')
    expect(snapshot.errors.databases).toBeNull()
    expect(snapshot.errors.collections).toBeNull()
    expect(snapshot.errors.builds).toBeNull()
    expect(snapshot.collections).toHaveLength(1)
    expect(snapshot.collections[0]).toMatchObject({
      name: 'orders',
      totalIndexSizeBytes: 300,
      usageUnavailable: false,
      error: null,
    })
    expect(snapshot.collections[0]?.indexes).toEqual([
      {
        name: '_id_',
        keyLabel: '_id:1',
        flags: [],
        sizeBytes: 100,
        ops: null,
        since: null,
        building: false,
        buildPercent: null,
        buildMessage: null,
      },
      {
        name: 'status_1',
        keyLabel: 'status:1',
        flags: ['unique'],
        sizeBytes: 200,
        ops: 9,
        since: new Date('2024-03-01T00:00:00.000Z'),
        building: false,
        buildPercent: null,
        buildMessage: null,
      },
    ])
  })

  it('joins $currentOp build progress onto matching indexes', async () => {
    const client = createFakeClient({
      listDatabases: async () => ({ databases: [{ name: 'shop' }] }),
      listCollections: async () => ({ cursor: { firstBatch: [{ name: 'orders' }] } }),
      indexes: async () => [
        { name: '_id_', key: { _id: 1 } },
        { name: 'status_1', key: { status: 1 } },
      ],
      collStats: async () => ({ indexSizes: { _id_: 1, status_1: 2 }, totalIndexSize: 3 }),
      indexStats: async () => [],
      currentOpBuilds: async () => [
        {
          op: 'command',
          ns: 'shop.orders',
          msg: 'Index Build: 55%',
          progress: { done: 55, total: 100 },
          command: {
            createIndexes: 'orders',
            indexes: [{ name: 'status_1', key: { status: 1 } }],
          },
        },
      ],
    })

    const { snapshot } = await fetchIndexesSnapshot(client, 'shop')
    const status = snapshot.collections[0]?.indexes.find((row) => row.name === 'status_1')
    expect(status).toMatchObject({
      building: true,
      buildPercent: 55,
      buildMessage: 'Index Build: 55%',
    })
  })

  it('returns databases only when no database is selected', async () => {
    const client = createFakeClient({
      listDatabases: async () => ({ databases: [{ name: 'shop' }] }),
    })

    const { snapshot } = await fetchIndexesSnapshot(client, null)
    expect(snapshot.databases).toEqual(['shop'])
    expect(snapshot.collections).toEqual([])
  })

  it('isolates $indexStats failures as usageUnavailable', async () => {
    const client = createFakeClient({
      listDatabases: async () => ({ databases: [{ name: 'shop' }] }),
      listCollections: async () => ({ cursor: { firstBatch: [{ name: 'orders' }] } }),
      indexes: async () => [{ name: '_id_', key: { _id: 1 } }],
      collStats: async () => ({ indexSizes: { _id_: 10 }, totalIndexSize: 10 }),
      indexStats: async () => {
        throw Object.assign(new Error('not authorized'), { code: 13 })
      },
    })

    const { snapshot } = await fetchIndexesSnapshot(client, 'shop')
    expect(snapshot.collections[0]?.usageUnavailable).toBe(true)
    expect(snapshot.collections[0]?.indexes[0]?.sizeBytes).toBe(10)
    expect(snapshot.collections[0]?.indexes[0]?.ops).toBeNull()
  })

  it('surfaces listCollections permission errors without dropping databases', async () => {
    const client = createFakeClient({
      listDatabases: async () => ({ databases: [{ name: 'shop' }] }),
      listCollections: async () => {
        throw Object.assign(new Error('not authorized'), { code: 13 })
      },
    })

    const { snapshot } = await fetchIndexesSnapshot(client, 'shop')
    expect(snapshot.databases).toEqual(['shop'])
    expect(snapshot.errors.collections).toEqual({
      kind: 'permission',
      message: 'insufficient permissions',
    })
    expect(snapshot.collections).toEqual([])
  })

  it('surfaces build-progress permission errors without blanking inventory', async () => {
    const client = createFakeClient({
      listDatabases: async () => ({ databases: [{ name: 'shop' }] }),
      listCollections: async () => ({ cursor: { firstBatch: [{ name: 'orders' }] } }),
      indexes: async () => [{ name: '_id_', key: { _id: 1 } }],
      collStats: async () => ({ indexSizes: { _id_: 10 }, totalIndexSize: 10 }),
      indexStats: async () => [],
      currentOpBuilds: async () => {
        throw Object.assign(new Error('not authorized'), { code: 13 })
      },
    })

    const { snapshot } = await fetchIndexesSnapshot(client, 'shop')
    expect(snapshot.errors.builds?.kind).toBe('permission')
    expect(snapshot.collections[0]?.indexes).toHaveLength(1)
  })
})
