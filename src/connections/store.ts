import { hostLabelFromUri } from '../lib/mongodb-uri'
import { defaultSecretStore, type SecretStore } from './secret-store'
import type { ConnectionProfile, ConnectionsBlob, StoredConnection } from './types'
import { toConnectionProfile } from './validate'

export type AddConnectionInput = {
  name: string
  /** Full MongoDB connection URI — stored only inside the OS keychain blob. */
  uri: string
  tags?: string[]
}

export type ConnectionStore = {
  list(): Promise<ConnectionProfile[]>
  add(input: AddConnectionInput): Promise<ConnectionProfile>
  remove(id: string): Promise<void>
  /** Resolve the stored URI for a profile (for a future live-connect path). */
  getUri(id: string): Promise<string | null>
}

export type ConnectionStoreDeps = {
  secrets?: SecretStore
  now?: () => Date
  createId?: () => string
}

export function createConnectionStore(deps: ConnectionStoreDeps = {}): ConnectionStore {
  const secrets = deps.secrets ?? defaultSecretStore
  const now = deps.now ?? (() => new Date())
  const createId = deps.createId ?? (() => crypto.randomUUID())

  return {
    async list() {
      const blob = await secrets.load()
      return blob.connections.map(toConnectionProfile)
    },

    async add(input) {
      const name = requireTrimmed(input.name, 'name')
      const uri = requireTrimmed(input.uri, 'uri')
      const tags = normalizeTags(input.tags)
      const hostLabel = hostLabelFromUri(uri)

      const blob = await secrets.load()
      assertNameAvailable(blob, name)

      const connection: StoredConnection = {
        id: createId(),
        name,
        hostLabel,
        tags,
        createdAt: now().toISOString(),
        uri,
      }

      const nextBlob: ConnectionsBlob = {
        version: 1,
        connections: [...blob.connections, connection],
      }

      await secrets.save(nextBlob)
      return toConnectionProfile(connection)
    },

    async remove(id) {
      const trimmedId = requireTrimmed(id, 'id')
      const blob = await secrets.load()
      const remaining = blob.connections.filter((connection) => connection.id !== trimmedId)
      if (remaining.length === blob.connections.length) {
        throw new Error(`Connection not found: ${trimmedId}`)
      }

      if (remaining.length === 0) {
        await secrets.clear()
        return
      }

      await secrets.save({ version: 1, connections: remaining })
    },

    async getUri(id) {
      const trimmedId = requireTrimmed(id, 'id')
      const blob = await secrets.load()
      const connection = blob.connections.find((entry) => entry.id === trimmedId)
      return connection?.uri ?? null
    },
  }
}

export const connectionStore = createConnectionStore()

export async function list(): Promise<ConnectionProfile[]> {
  return connectionStore.list()
}

export async function add(input: AddConnectionInput): Promise<ConnectionProfile> {
  return connectionStore.add(input)
}

export async function remove(id: string): Promise<void> {
  return connectionStore.remove(id)
}

function assertNameAvailable(blob: ConnectionsBlob, name: string): void {
  const normalizedName = name.toLowerCase()
  if (blob.connections.some((connection) => connection.name.toLowerCase() === normalizedName)) {
    throw new Error(`A connection named "${name}" already exists`)
  }
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (tags == null) {
    return []
  }
  return tags.map((tag) => requireTrimmed(tag, 'tag'))
}

function requireTrimmed(value: string, field: string): string {
  const trimmed = value.trim()
  if (trimmed === '') {
    throw new Error(`${field} must be a non-empty string`)
  }
  return trimmed
}
