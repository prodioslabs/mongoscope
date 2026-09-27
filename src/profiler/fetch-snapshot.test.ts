import { describe, expect, it } from 'vitest'
import type { CollectionLike, MongoClientLike, MongoDbLike } from '../live-connection'
import { fetchProfilerSlowQueriesSnapshot } from './fetch-snapshot'

type FakeDb = MongoDbLike & { name: string }

function createFakeClient(handlers: {
  listDatabases?: () => Promise<unknown>
  profile?: (dbName: string, command: Record<string, unknown>) => Promise<unknown>
  profileDocs?: (dbName: string) => Promise<unknown[]>
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
              if ('listDatabases' in command) {
                return handlers.listDatabases?.() ?? { databases: [] }
              }
              throw new Error(`unexpected admin command ${JSON.stringify(command)}`)
            },
          }
        },
        async command(command) {
          if ('profile' in command) {
            return (
              handlers.profile?.(dbName, command) ?? {
                was: 0,
                slowms: 100,
                ok: 1,
              }
            )
          }
          throw new Error(`unexpected db command ${JSON.stringify(command)}`)
        },
        aggregate() {
          return {
            async toArray() {
              return []
            },
          }
        },
        collection(name): CollectionLike {
          return {
            find() {
              const cursor = {
                sort() {
                  return cursor
                },
                limit() {
                  return cursor
                },
                async toArray() {
                  if (name !== 'system.profile') {
                    return []
                  }
                  return handlers.profileDocs?.(dbName) ?? []
                },
              }
              return cursor
            },
            async indexes() {
              return []
            },
            aggregate() {
              return {
                async toArray() {
                  return []
                },
              }
            },
          }
        },
      }
      return fakeDb
    },
  }
}

describe('fetchProfilerSlowQueriesSnapshot', () => {
  it('loads databases, status, and builds patterns from profile docs', async () => {
    const client = createFakeClient({
      listDatabases: async () => ({
        databases: [{ name: 'app' }, { name: 'admin' }],
      }),
      profile: async () => ({ was: 1, slowms: 50, ok: 1 }),
      profileDocs: async () => [
        {
          ns: 'app.orders',
          op: 'query',
          millis: 120,
          planSummary: 'COLLSCAN',
          ts: new Date('2024-01-01T00:00:00.000Z'),
          command: { find: 'orders', filter: { a: 1 } },
          docsExamined: 10,
          nreturned: 1,
        },
      ],
    })

    const { snapshot } = await fetchProfilerSlowQueriesSnapshot(client, 'app')
    expect(snapshot.databases).toEqual(['app'])
    expect(snapshot.profiling).toEqual({ level: 1, slowms: 50 })
    expect(snapshot.patterns).toHaveLength(1)
    expect(snapshot.slowQueryCount).toBe(1)
    expect(snapshot.errors.status).toBeNull()
    expect(snapshot.errors.read).toBeNull()
  })

  it('surfaces distinct status permission errors', async () => {
    const client = createFakeClient({
      listDatabases: async () => ({ databases: [{ name: 'app' }] }),
      profile: async () => {
        throw { code: 13, codeName: 'Unauthorized' }
      },
      profileDocs: async () => [],
    })

    const { snapshot } = await fetchProfilerSlowQueriesSnapshot(client, 'app')
    expect(snapshot.errors.status?.message).toContain('enableProfiler')
    expect(snapshot.patterns).toEqual([])
  })
})
