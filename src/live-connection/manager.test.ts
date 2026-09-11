import { describe, expect, it, vi } from 'vitest'
import type { CollectionLike, MongoClientLike } from './client-factory'
import { LiveConnectionError } from './errors'
import { createLiveConnectionManager } from './manager'

type FakeClient = MongoClientLike & {
  closeListeners: Set<() => void>
  connectImpl: () => Promise<void>
  pingImpl: () => Promise<unknown>
  dbCommandImpl: (dbName: string, command: Record<string, unknown>) => Promise<unknown>
  collectionIndexesImpl: (dbName: string, collectionName: string) => Promise<unknown[]>
  collectionAggregateImpl: (
    dbName: string,
    collectionName: string,
    pipeline: Record<string, unknown>[],
  ) => Promise<unknown[]>
  closed: boolean
}

function createFakeClient(overrides?: {
  connectImpl?: () => Promise<void>
  pingImpl?: () => Promise<unknown>
  dbCommandImpl?: (dbName: string, command: Record<string, unknown>) => Promise<unknown>
  collectionIndexesImpl?: (dbName: string, collectionName: string) => Promise<unknown[]>
  collectionAggregateImpl?: (
    dbName: string,
    collectionName: string,
    pipeline: Record<string, unknown>[],
  ) => Promise<unknown[]>
}): FakeClient {
  const closeListeners = new Set<() => void>()
  const client: FakeClient = {
    closed: false,
    closeListeners,
    connectImpl: overrides?.connectImpl ?? (async () => {}),
    pingImpl: overrides?.pingImpl ?? (async () => ({ ok: 1 })),
    dbCommandImpl:
      overrides?.dbCommandImpl ??
      (async (_dbName, command) => {
        if (command.ping === 1 || command.ping === true) {
          return client.pingImpl()
        }
        return { ok: 1 }
      }),
    collectionIndexesImpl: overrides?.collectionIndexesImpl ?? (async () => []),
    collectionAggregateImpl: overrides?.collectionAggregateImpl ?? (async () => []),
    async connect() {
      await client.connectImpl()
    },
    async close() {
      client.closed = true
      for (const listener of closeListeners) {
        listener()
      }
    },
    db(dbName = 'test') {
      return {
        admin() {
          return {
            command: async (command) => {
              if (command.ping === 1 || command.ping === true) {
                return client.pingImpl()
              }
              return client.dbCommandImpl('admin', command)
            },
          }
        },
        command: async (command) => client.dbCommandImpl(dbName, command),
        aggregate() {
          return {
            async toArray() {
              return []
            },
          }
        },
        collection(name) {
          const collection: CollectionLike = {
            async indexes() {
              return client.collectionIndexesImpl(dbName, name)
            },
            aggregate(pipeline) {
              return {
                async toArray() {
                  return client.collectionAggregateImpl(dbName, name, pipeline)
                },
              }
            },
          }
          return collection
        },
      }
    },
    on(_event, listener) {
      closeListeners.add(listener)
      return client
    },
    off(_event, listener) {
      closeListeners.delete(listener)
      return client
    },
  }
  return client
}

describe('createLiveConnectionManager', () => {
  it('connects, pings, and reaches connected', async () => {
    const client = createFakeClient()
    const manager = createLiveConnectionManager({
      createClient: () => client,
    })

    await manager.connect('id-1', 'mongodb://127.0.0.1:27017')

    expect(manager.getSnapshot()).toMatchObject({
      status: 'connected',
      connectionId: 'id-1',
      errorMessage: '',
    })
    expect(manager.getActiveClient()).toBe(client)
  })

  it('maps connect failures to error without retaining a client', async () => {
    const manager = createLiveConnectionManager({
      createClient: () =>
        createFakeClient({
          connectImpl: async () => {
            const error = Object.assign(new Error('Authentication failed'), { code: 18 })
            throw error
          },
        }),
    })

    await manager.connect('id-1', 'mongodb://user:pass@127.0.0.1:27017')

    const snapshot = manager.getSnapshot()
    expect(snapshot.status).toBe('error')
    expect(snapshot.errorMessage).toBe('Authentication failed. Check username and password.')
    expect(snapshot.errorMessage).not.toContain('user:pass')
    expect(manager.getActiveClient()).toBeNull()
  })

  it('rejects malformed URIs before creating a client', async () => {
    const createClient = vi.fn()
    const manager = createLiveConnectionManager({ createClient })

    await manager.connect('id-1', 'not-a-uri')

    expect(createClient).not.toHaveBeenCalled()
    expect(manager.getSnapshot()).toMatchObject({
      status: 'error',
      errorMessage: 'Invalid MongoDB connection URI',
    })
  })

  it('discards a stale connect when a newer connect wins', async () => {
    let releaseSlow: (() => void) | undefined
    const slowGate = new Promise<void>((resolve) => {
      releaseSlow = resolve
    })
    let resolveSlowStarted: (() => void) | undefined
    const slowStarted = new Promise<void>((resolve) => {
      resolveSlowStarted = resolve
    })

    const clientsById = new Map<string, FakeClient>()
    const manager = createLiveConnectionManager({
      createClient: (uri) => {
        const isSlow = uri.includes('27017')
        const client = createFakeClient({
          connectImpl: isSlow
            ? async () => {
                resolveSlowStarted?.()
                await slowGate
              }
            : async () => {},
        })
        clientsById.set(isSlow ? 'id-slow' : 'id-fast', client)
        return client
      },
    })

    const slowConnect = manager.connect('id-slow', 'mongodb://127.0.0.1:27017')
    await slowStarted
    const fastConnect = manager.connect('id-fast', 'mongodb://127.0.0.1:27018')

    releaseSlow?.()
    await Promise.all([slowConnect, fastConnect])

    const slowClient = clientsById.get('id-slow')
    const fastClient = clientsById.get('id-fast')
    expect(manager.getSnapshot().connectionId).toBe('id-fast')
    expect(manager.getSnapshot().status).toBe('connected')
    expect(manager.getActiveClient()).toBe(fastClient)
    expect(slowClient?.closed).toBe(true)
  })

  it('clears to idle on user disconnect', async () => {
    const client = createFakeClient()
    const manager = createLiveConnectionManager({
      createClient: () => client,
    })

    await manager.connect('id-1', 'mongodb://127.0.0.1:27017')
    await manager.disconnect('user')

    expect(manager.getSnapshot()).toMatchObject({
      status: 'idle',
      connectionId: null,
      errorMessage: '',
    })
    expect(client.closed).toBe(true)
    expect(manager.getActiveClient()).toBeNull()
  })

  it('surfaces unexpected close as disconnected', async () => {
    const client = createFakeClient()
    const manager = createLiveConnectionManager({
      createClient: () => client,
    })

    await manager.connect('id-1', 'mongodb://127.0.0.1:27017')
    for (const listener of client.closeListeners) {
      listener()
    }

    expect(manager.getSnapshot()).toMatchObject({
      status: 'disconnected',
      connectionId: 'id-1',
      errorMessage: 'Connection lost.',
    })
  })

  it('checkHealth marks disconnected when ping fails', async () => {
    const client = createFakeClient({
      pingImpl: async () => {
        throw new Error('socket hang up')
      },
    })
    // First ping during connect must succeed.
    let pingCount = 0
    client.pingImpl = async () => {
      pingCount += 1
      if (pingCount === 1) {
        return { ok: 1 }
      }
      throw new Error('socket hang up')
    }

    const manager = createLiveConnectionManager({
      createClient: () => client,
    })

    await manager.connect('id-1', 'mongodb://127.0.0.1:27017')
    const healthy = await manager.checkHealth()

    expect(healthy).toBe(false)
    expect(manager.getSnapshot().status).toBe('disconnected')
  })

  it('fail() sets error for missing URI without retaining a client', async () => {
    const manager = createLiveConnectionManager()
    await manager.fail(
      'id-missing',
      new LiveConnectionError('missing_uri', 'Connection profile not found or has no URI.'),
    )

    expect(manager.getSnapshot()).toMatchObject({
      status: 'error',
      connectionId: 'id-missing',
      errorMessage: 'Connection profile not found or has no URI.',
    })
  })

  it('retry reuses the last uri for the same connection id', async () => {
    let attempts = 0
    const manager = createLiveConnectionManager({
      createClient: () =>
        createFakeClient({
          connectImpl: async () => {
            attempts += 1
            if (attempts === 1) {
              throw Object.assign(new Error('Authentication failed'), { code: 18 })
            }
          },
        }),
    })

    await manager.connect('id-1', 'mongodb://127.0.0.1:27017')
    expect(manager.getSnapshot().status).toBe('error')

    await manager.retry()
    expect(manager.getSnapshot().status).toBe('connected')
    expect(attempts).toBe(2)
  })

  it('notifies subscribers on status changes', async () => {
    const client = createFakeClient()
    const manager = createLiveConnectionManager({
      createClient: () => client,
    })
    const statuses: string[] = []
    const unsubscribe = manager.subscribe((snapshot) => {
      statuses.push(snapshot.status)
    })

    await manager.connect('id-1', 'mongodb://127.0.0.1:27017')
    unsubscribe()

    expect(statuses[0]).toBe('idle')
    expect(statuses).toContain('connecting')
    expect(statuses.at(-1)).toBe('connected')
  })

  it('exposes db.command, collection.indexes, and collection.aggregate through the client seam', async () => {
    const client = createFakeClient({
      dbCommandImpl: async (dbName, command) => {
        if (dbName === 'shop' && command.collStats === 'orders') {
          return { indexSizes: { _id_: 1024 }, totalIndexSize: 1024 }
        }
        if (dbName === 'admin' && command.listDatabases === 1) {
          return { databases: [{ name: 'shop' }] }
        }
        return { ok: 1 }
      },
      collectionIndexesImpl: async (dbName, collectionName) => {
        if (dbName === 'shop' && collectionName === 'orders') {
          return [{ name: '_id_', key: { _id: 1 } }]
        }
        return []
      },
      collectionAggregateImpl: async (dbName, collectionName, pipeline) => {
        if (
          dbName === 'shop' &&
          collectionName === 'orders' &&
          pipeline[0] &&
          '$indexStats' in pipeline[0]
        ) {
          return [
            {
              name: '_id_',
              accesses: { ops: 12, since: new Date('2024-01-01T00:00:00.000Z') },
            },
          ]
        }
        return []
      },
    })
    const manager = createLiveConnectionManager({
      createClient: () => client,
    })

    await manager.connect('id-1', 'mongodb://127.0.0.1:27017')
    const active = manager.getActiveClient()
    expect(active).toBe(client)

    const listed = await active!.db('admin').admin().command({ listDatabases: 1, nameOnly: true })
    expect(listed).toEqual({ databases: [{ name: 'shop' }] })

    const shop = active!.db('shop')
    const stats = await shop.command({ collStats: 'orders' })
    expect(stats).toEqual({ indexSizes: { _id_: 1024 }, totalIndexSize: 1024 })

    const indexes = await shop.collection('orders').indexes()
    expect(indexes).toEqual([{ name: '_id_', key: { _id: 1 } }])

    const usage = await shop
      .collection('orders')
      .aggregate([{ $indexStats: {} }])
      .toArray()
    expect(usage).toHaveLength(1)
  })
})
