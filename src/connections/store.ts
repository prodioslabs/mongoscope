import { hostLabelFromUri } from '../lib/mongodb-uri'
import { defaultSecretStore, type SecretStore } from './secret-store'
import type {
  AddConnectionInput,
  ConnectionProfile,
  ConnectionsBlob,
  StoredConnection,
  UpdateConnectionInput,
} from './types'
import { toConnectionProfile } from './validate'

export type ConnectionStore = {
  list(): Promise<ConnectionProfile[]>
  add(input: AddConnectionInput): Promise<ConnectionProfile>
  update(id: string, input: UpdateConnectionInput): Promise<ConnectionProfile>
  remove(id: string): Promise<void>
  /** Full URI from the keychain blob for live-connect — never log the return value. */
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

    async update(id, input) {
      const trimmedId = requireTrimmed(id, 'id')
      const name = requireTrimmed(input.name, 'name')
      const uri = requireTrimmed(input.uri, 'uri')
      const tags = normalizeTags(input.tags)
      const hostLabel = hostLabelFromUri(uri)

      const blob = await secrets.load()
      const index = blob.connections.findIndex((connection) => connection.id === trimmedId)
      if (index < 0) {
        throw new Error(`Connection not found: ${trimmedId}`)
      }

      assertNameAvailable(blob, name, trimmedId)

      const previous = blob.connections[index]!
      const connection: StoredConnection = {
        ...previous,
        name,
        hostLabel,
        tags,
        uri,
      }

      const connections = blob.connections.slice()
      connections[index] = connection
      await secrets.save({ version: 1, connections })
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

function assertNameAvailable(blob: ConnectionsBlob, name: string, exceptId?: string): void {
  const normalizedName = name.toLowerCase()
  if (
    blob.connections.some(
      (connection) =>
        connection.name.toLowerCase() === normalizedName && connection.id !== exceptId,
    )
  ) {
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
