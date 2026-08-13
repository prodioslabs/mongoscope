import { describe, expect, it } from 'vitest'
import {
  CONNECTIONS_SECRET_NAME,
  createSecretStore,
  SECRET_SERVICE,
  SecretStoreError,
  type SecretBackend,
} from './secret-store'
import { createConnectionStore } from './store'
import { validateConnectionsBlob } from './validate'

function createMemoryBackend(): SecretBackend & {
  values: Map<string, string>
  setCalls: number
  deleteCalls: number
  failNextSet?: Error
  failNextDelete?: Error
  failNextGet?: Error
} {
  const values = new Map<string, string>()
  const backend = {
    values,
    setCalls: 0,
    deleteCalls: 0,
    failNextSet: undefined as Error | undefined,
    failNextDelete: undefined as Error | undefined,
    failNextGet: undefined as Error | undefined,
    async get({ service, name }: { service: string; name: string }) {
      if (backend.failNextGet) {
        const error = backend.failNextGet
        backend.failNextGet = undefined
        throw error
      }
      return values.get(`${service}\0${name}`) ?? null
    },
    async set({ service, name, value }: { service: string; name: string; value: string }) {
      backend.setCalls += 1
      if (backend.failNextSet) {
        const error = backend.failNextSet
        backend.failNextSet = undefined
        throw error
      }
      values.set(`${service}\0${name}`, value)
    },
    async delete({ service, name }: { service: string; name: string }) {
      backend.deleteCalls += 1
      if (backend.failNextDelete) {
        const error = backend.failNextDelete
        backend.failNextDelete = undefined
        throw error
      }
      return values.delete(`${service}\0${name}`)
    },
  }
  return backend
}

describe('createSecretStore', () => {
  it('uses a single fixed service and name for the connections blob', async () => {
    const backend = createMemoryBackend()
    const store = createSecretStore(backend)

    await store.save({
      version: 1,
      connections: [
        {
          id: 'abc',
          name: 'local',
          hostLabel: 'localhost:27017',
          tags: [],
          createdAt: '2026-08-11T12:00:00.000Z',
          uri: 'mongodb://localhost:27017',
        },
      ],
    })

    expect([...backend.values.keys()]).toEqual([`${SECRET_SERVICE}\0${CONNECTIONS_SECRET_NAME}`])

    const loaded = await store.load()
    expect(loaded.connections).toHaveLength(1)
    expect(loaded.connections[0]!.uri).toBe('mongodb://localhost:27017')
  })

  it('returns an empty blob when the secret is missing', async () => {
    const backend = createMemoryBackend()
    const store = createSecretStore(backend)
    await expect(store.load()).resolves.toEqual({ version: 1, connections: [] })
  })

  it('maps keychain failures without including the URI in the message', async () => {
    const backend = createMemoryBackend()
    backend.failNextSet = new Error('libsecret: secret service not available')
    const store = createSecretStore(backend)
    const uri = 'mongodb://user:super-secret@localhost:27017'

    let caught: unknown
    try {
      await store.save({
        version: 1,
        connections: [
          {
            id: 'abc',
            name: 'local',
            hostLabel: 'localhost:27017',
            tags: [],
            createdAt: '2026-08-11T12:00:00.000Z',
            uri,
          },
        ],
      })
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(SecretStoreError)
    const secretError = caught as SecretStoreError
    expect(secretError.message).not.toContain(uri)
    expect(secretError.message).not.toContain('super-secret')
    expect(secretError.message).toMatch(/libsecret|secret service/i)
    expect(secretError.code).toBe('unavailable')
  })
})

describe('validateConnectionsBlob', () => {
  it('rejects unsupported version', () => {
    expect(() => validateConnectionsBlob({ version: 2, connections: [] })).toThrow(
      /unsupported version/,
    )
  })

  it('requires uri on each connection', () => {
    expect(() =>
      validateConnectionsBlob({
        version: 1,
        connections: [
          {
            id: 'abc',
            name: 'local',
            hostLabel: 'localhost:27017',
            tags: [],
            createdAt: '2026-08-11T12:00:00.000Z',
          },
        ],
      }),
    ).toThrow(/uri must be a non-empty string/)
  })
})

describe('createConnectionStore', () => {
  it('adds a profile, stores URI only in the keychain blob, and lists without URI', async () => {
    const backend = createMemoryBackend()
    const store = createConnectionStore({
      secrets: createSecretStore(backend),
      createId: () => 'fixed-id',
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    })

    const uri = 'mongodb://alice:hunter2@127.0.0.1:27017/admin'
    const profile = await store.add({ name: 'local', uri, tags: ['dev'] })

    expect(profile).toEqual({
      id: 'fixed-id',
      name: 'local',
      hostLabel: '127.0.0.1:27017',
      tags: ['dev'],
      createdAt: '2026-08-11T12:00:00.000Z',
    })
    expect(profile).not.toHaveProperty('uri')

    const listed = await store.list()
    expect(listed).toEqual([profile])
    expect(JSON.stringify(listed)).not.toContain('hunter2')
    expect(JSON.stringify(listed)).not.toContain(uri)

    await expect(store.getUri(profile.id)).resolves.toBe(uri)

    const raw = backend.values.get(`${SECRET_SERVICE}\0${CONNECTIONS_SECRET_NAME}`)
    expect(raw).toContain(uri)
  })

  it('rejects duplicate names before writing the blob', async () => {
    const backend = createMemoryBackend()
    const store = createConnectionStore({
      secrets: createSecretStore(backend),
    })

    await store.add({ name: 'local', uri: 'mongodb://localhost:27017' })
    await expect(store.add({ name: 'Local', uri: 'mongodb://localhost:27018' })).rejects.toThrow(
      /already exists/,
    )
    expect(backend.setCalls).toBe(1)
  })

  it('removes a connection and clears the secret when empty', async () => {
    const backend = createMemoryBackend()
    const store = createConnectionStore({
      secrets: createSecretStore(backend),
      createId: () => 'to-remove',
    })

    await store.add({ name: 'local', uri: 'mongodb://localhost:27017' })
    await store.remove('to-remove')

    await expect(store.list()).resolves.toEqual([])
    expect(backend.values.size).toBe(0)
    expect(backend.deleteCalls).toBe(1)
  })
})
