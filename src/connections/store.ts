import { connectionsFilePath, loadConnections, saveConnections } from './config'
import { hostLabelFromUri } from '../lib/mongodb-uri'
import { defaultSecretStore, type SecretStore } from './secret-store'
import type { ConnectionProfile, ConnectionsFile } from './types'

export type AddConnectionInput = {
  name: string
  /** Full MongoDB connection URI — the only credential stored for v1. */
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
  filePath?: string
  secrets?: SecretStore
  load?: (filePath: string) => Promise<ConnectionsFile>
  save?: (file: ConnectionsFile, filePath: string) => Promise<void>
  now?: () => Date
  createId?: () => string
}

export function createConnectionStore(deps: ConnectionStoreDeps = {}): ConnectionStore {
  const filePath = deps.filePath ?? connectionsFilePath()
  const secrets = deps.secrets ?? defaultSecretStore
  const load = deps.load ?? loadConnections
  const save = deps.save ?? saveConnections
  const now = deps.now ?? (() => new Date())
  const createId = deps.createId ?? (() => crypto.randomUUID())

  return {
    async list() {
      const file = await load(filePath)
      return file.connections.slice()
    },

    async add(input) {
      const name = requireTrimmed(input.name, 'name')
      const uri = requireTrimmed(input.uri, 'uri')
      const tags = normalizeTags(input.tags)
      const hostLabel = hostLabelFromUri(uri)

      const file = await load(filePath)
      assertNameAvailable(file, name)

      const profile: ConnectionProfile = {
        id: createId(),
        name,
        hostLabel,
        tags,
        createdAt: now().toISOString(),
      }

      await secrets.setUri(profile.id, uri)

      const nextFile: ConnectionsFile = {
        version: 1,
        connections: [...file.connections, profile],
      }

      try {
        await save(nextFile, filePath)
      } catch (error) {
        try {
          await secrets.deleteUri(profile.id)
        } catch {
          // best-effort rollback only
        }
        throw error
      }

      return profile
    },

    async remove(id) {
      const trimmedId = requireTrimmed(id, 'id')
      const file = await load(filePath)
      const remaining = file.connections.filter((profile) => profile.id !== trimmedId)
      if (remaining.length === file.connections.length) {
        throw new Error(`Connection not found: ${trimmedId}`)
      }

      await save({ version: 1, connections: remaining }, filePath)

      try {
        await secrets.deleteUri(trimmedId)
      } catch {
        // Metadata already removed; secret cleanup is best-effort.
      }
    },

    async getUri(id) {
      return secrets.getUri(requireTrimmed(id, 'id'))
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

function assertNameAvailable(file: ConnectionsFile, name: string): void {
  const normalizedName = name.toLowerCase()
  if (file.connections.some((profile) => profile.name.toLowerCase() === normalizedName)) {
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
