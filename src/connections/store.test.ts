import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadConnections } from './config'
import {
  createSecretStore,
  SECRET_SERVICE,
  SecretStoreError,
  secretNameForConnection,
  type SecretBackend,
} from './secret-store'
import { createConnectionStore } from './store'

const temporaryDirectories: string[] = []

afterEach(async function cleanupTemporaryDirectories() {
  while (temporaryDirectories.length > 0) {
    const directoryPath = temporaryDirectories.pop()
    if (directoryPath) {
      await rm(directoryPath, { recursive: true, force: true })
    }
  }
})

async function makeTemporaryDirectory(): Promise<string> {
  const directoryPath = await mkdtemp(join(tmpdir(), 'mongoscope-conn-store-'))
  temporaryDirectories.push(directoryPath)
  return directoryPath
}

function createMemoryBackend(): SecretBackend & {
  values: Map<string, string>
  setCalls: number
  deleteCalls: number
  failNextSet?: Error
  failNextDelete?: Error
} {
  const values = new Map<string, string>()
  const backend = {
    values,
    setCalls: 0,
    deleteCalls: 0,
    failNextSet: undefined as Error | undefined,
    failNextDelete: undefined as Error | undefined,
    async get({ service, name }: { service: string; name: string }) {
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
  it('uses the planned service and name keys', async () => {
    const backend = createMemoryBackend()
    const store = createSecretStore(backend)
    await store.setUri('abc', 'mongodb://localhost:27017')
    expect([...backend.values.keys()]).toEqual([
      `${SECRET_SERVICE}\0${secretNameForConnection('abc')}`,
    ])
    await expect(store.getUri('abc')).resolves.toBe('mongodb://localhost:27017')
  })

  it('maps keychain failures without including the URI in the message', async () => {
    const backend = createMemoryBackend()
    backend.failNextSet = new Error('libsecret: secret service not available')
    const store = createSecretStore(backend)
    const uri = 'mongodb://user:super-secret@localhost:27017'

    let caught: unknown
    try {
      await store.setUri('abc', uri)
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

describe('createConnectionStore', () => {
  it('adds a profile with URI-only credentials and lists it', async () => {
    const directoryPath = await makeTemporaryDirectory()
    const filePath = join(directoryPath, 'connections.json')
    const backend = createMemoryBackend()
    const store = createConnectionStore({
      filePath,
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

    const file = await loadConnections(filePath)
    expect(file.connections).toEqual([profile])
    expect(JSON.stringify(file)).not.toContain('hunter2')
    expect(JSON.stringify(file)).not.toContain(uri)

    await expect(store.getUri(profile.id)).resolves.toBe(uri)
    await expect(store.list()).resolves.toEqual([profile])
  })

  it('rejects duplicate names before writing secrets', async () => {
    const directoryPath = await makeTemporaryDirectory()
    const filePath = join(directoryPath, 'connections.json')
    const backend = createMemoryBackend()
    const store = createConnectionStore({
      filePath,
      secrets: createSecretStore(backend),
    })

    await store.add({ name: 'local', uri: 'mongodb://localhost:27017' })
    await expect(store.add({ name: 'Local', uri: 'mongodb://localhost:27018' })).rejects.toThrow(
      /already exists/,
    )
    expect(backend.setCalls).toBe(1)
  })

  it('rolls back the secret when metadata save fails', async () => {
    const directoryPath = await makeTemporaryDirectory()
    const filePath = join(directoryPath, 'connections.json')
    const backend = createMemoryBackend()
    const store = createConnectionStore({
      filePath,
      secrets: createSecretStore(backend),
      createId: () => 'rollback-id',
      async save() {
        throw new Error('disk full')
      },
    })

    await expect(store.add({ name: 'local', uri: 'mongodb://localhost:27017' })).rejects.toThrow(
      /disk full/,
    )
    expect(backend.setCalls).toBe(1)
    expect(backend.deleteCalls).toBe(1)
    expect(backend.values.size).toBe(0)
  })

  it('removes metadata and deletes the secret', async () => {
    const directoryPath = await makeTemporaryDirectory()
    const filePath = join(directoryPath, 'connections.json')
    const backend = createMemoryBackend()
    const store = createConnectionStore({
      filePath,
      secrets: createSecretStore(backend),
      createId: () => 'to-remove',
    })

    await store.add({ name: 'local', uri: 'mongodb://localhost:27017' })
    await store.remove('to-remove')

    await expect(store.list()).resolves.toEqual([])
    expect(backend.values.size).toBe(0)
  })
})
