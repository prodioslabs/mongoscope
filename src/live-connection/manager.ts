import { hostLabelFromUri } from '../lib/mongodb-uri'
import {
  buildConnectOptions,
  DEFAULT_CONNECT_TIMEOUT_MS,
  defaultCreateMongoClient,
  type CreateMongoClient,
  type MongoClientLike,
} from './client-factory'
import { LiveConnectionError, mapConnectFailure } from './errors'
import {
  IDLE_LIVE_CONNECTION_SNAPSHOT,
  type LiveConnectionDisconnectReason,
  type LiveConnectionSnapshot,
} from './types'

export type LiveConnectionManager = {
  connect(connectionId: string, uri: string): Promise<void>
  disconnect(reason?: LiveConnectionDisconnectReason): Promise<void>
  retry(): Promise<void>
  /** Put the manager in error for a selected profile (e.g. getUri returned null). */
  fail(connectionId: string, error: LiveConnectionError): Promise<void>
  getActiveClient(): MongoClientLike | null
  getActiveDb(dbName?: string): ReturnType<MongoClientLike['db']> | null
  getSnapshot(): LiveConnectionSnapshot
  subscribe(listener: (snapshot: LiveConnectionSnapshot) => void): () => void
  checkHealth(): Promise<boolean>
}

export type LiveConnectionManagerDeps = {
  createClient?: CreateMongoClient
  connectTimeoutMs?: number
}

type InternalState = {
  snapshot: LiveConnectionSnapshot
  client: MongoClientLike | null
  /** Last URI used for connect/retry (never logged). */
  lastUri: string | null
  closeListener: (() => void) | null
}

export function createLiveConnectionManager(
  deps: LiveConnectionManagerDeps = {},
): LiveConnectionManager {
  const createClient = deps.createClient ?? defaultCreateMongoClient
  const connectTimeoutMs = deps.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS

  const state: InternalState = {
    snapshot: { ...IDLE_LIVE_CONNECTION_SNAPSHOT },
    client: null,
    lastUri: null,
    closeListener: null,
  }

  const listeners = new Set<(snapshot: LiveConnectionSnapshot) => void>()

  function emit(): void {
    const snapshot = state.snapshot
    for (const listener of listeners) {
      listener(snapshot)
    }
  }

  function setSnapshot(partial: Partial<LiveConnectionSnapshot>): void {
    state.snapshot = {
      ...state.snapshot,
      ...partial,
    }
    emit()
  }

  function nextGeneration(): number {
    return state.snapshot.generation + 1
  }

  function detachCloseListener(client: MongoClientLike | null): void {
    if (client == null || state.closeListener == null) {
      state.closeListener = null
      return
    }
    const listener = state.closeListener
    state.closeListener = null
    if (typeof client.off === 'function') {
      client.off('close', listener)
    }
  }

  async function closeClientQuietly(client: MongoClientLike | null): Promise<void> {
    if (client == null) {
      return
    }
    detachCloseListener(client)
    try {
      await client.close(true)
    } catch {
      // Discard close errors — caller already owns the transition.
    }
  }

  function attachCloseListener(client: MongoClientLike, generation: number): void {
    detachCloseListener(client)
    if (typeof client.on !== 'function') {
      return
    }
    const listener = function onClientClose() {
      if (state.snapshot.generation !== generation) {
        return
      }
      if (state.client !== client) {
        return
      }
      state.client = null
      setSnapshot({
        status: 'disconnected',
        errorMessage: 'Connection lost.',
      })
    }
    state.closeListener = listener
    client.on('close', listener)
  }

  async function clearClient(): Promise<MongoClientLike | null> {
    const previous = state.client
    state.client = null
    detachCloseListener(previous)
    await closeClientQuietly(previous)
    return previous
  }

  async function openConnection(connectionId: string, uri: string): Promise<void> {
    try {
      hostLabelFromUri(uri)
    } catch (error) {
      const generation = nextGeneration()
      await clearClient()
      state.lastUri = uri
      const mapped = mapConnectFailure(error)
      setSnapshot({
        status: 'error',
        connectionId,
        errorMessage: mapped.message,
        generation,
      })
      return
    }

    const generation = nextGeneration()
    state.lastUri = uri
    setSnapshot({
      status: 'connecting',
      connectionId,
      errorMessage: '',
      generation,
    })

    await clearClient()

    if (state.snapshot.generation !== generation) {
      return
    }

    let client: MongoClientLike
    try {
      client = createClient(uri, buildConnectOptions(connectTimeoutMs))
      await client.connect()
      await client.db().admin().command({ ping: 1 })
    } catch (error) {
      if (state.snapshot.generation !== generation) {
        return
      }
      const mapped = mapConnectFailure(error)
      state.client = null
      setSnapshot({
        status: 'error',
        connectionId,
        errorMessage: mapped.message,
        generation,
      })
      return
    }

    if (state.snapshot.generation !== generation) {
      await closeClientQuietly(client)
      return
    }

    state.client = client
    attachCloseListener(client, generation)
    setSnapshot({
      status: 'connected',
      connectionId,
      errorMessage: '',
      generation,
    })
  }

  return {
    async connect(connectionId, uri) {
      await openConnection(connectionId, uri)
    },

    async disconnect(reason = 'user') {
      const generation = nextGeneration()
      await clearClient()

      if (reason === 'user') {
        state.lastUri = null
        setSnapshot({
          status: 'idle',
          connectionId: null,
          errorMessage: '',
          generation,
        })
        return
      }

      if (reason === 'drop') {
        setSnapshot({
          status: 'disconnected',
          connectionId: state.snapshot.connectionId,
          errorMessage: 'Connection lost.',
          generation,
        })
        return
      }

      // switch: caller will immediately connect(); leave connecting with current id
      setSnapshot({
        status: 'connecting',
        connectionId: state.snapshot.connectionId,
        errorMessage: '',
        generation,
      })
    },

    async retry() {
      const connectionId = state.snapshot.connectionId
      const uri = state.lastUri
      if (connectionId == null || uri == null) {
        const generation = nextGeneration()
        setSnapshot({
          status: 'error',
          errorMessage: 'Connection profile not found or has no URI.',
          generation,
        })
        return
      }
      await openConnection(connectionId, uri)
    },

    async fail(connectionId, error) {
      const generation = nextGeneration()
      await clearClient()
      state.lastUri = null
      setSnapshot({
        status: 'error',
        connectionId,
        errorMessage: error.message,
        generation,
      })
    },

    getActiveClient() {
      if (state.snapshot.status !== 'connected') {
        return null
      }
      return state.client
    },

    getActiveDb(dbName) {
      const client = this.getActiveClient()
      if (client == null) {
        return null
      }
      return client.db(dbName)
    },

    getSnapshot() {
      return state.snapshot
    },

    subscribe(listener) {
      listeners.add(listener)
      listener(state.snapshot)
      return function unsubscribe() {
        listeners.delete(listener)
      }
    },

    async checkHealth() {
      const client = state.client
      const generation = state.snapshot.generation
      if (state.snapshot.status !== 'connected' || client == null) {
        return false
      }
      try {
        await client.db().admin().command({ ping: 1 })
        return state.snapshot.generation === generation && state.snapshot.status === 'connected'
      } catch {
        if (state.snapshot.generation !== generation) {
          return false
        }
        state.client = null
        await closeClientQuietly(client)
        setSnapshot({
          status: 'disconnected',
          errorMessage: 'Connection lost.',
        })
        return false
      }
    },
  }
}

export const liveConnectionManager = createLiveConnectionManager()
