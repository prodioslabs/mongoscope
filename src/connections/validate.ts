import { isRecord } from '../lib/is-record'
import type { ConnectionProfile, ConnectionsBlob, StoredConnection } from './types'

export function emptyConnectionsBlob(): ConnectionsBlob {
  return { version: 1, connections: [] }
}

export function validateConnectionsBlob(value: unknown): ConnectionsBlob {
  if (!isRecord(value)) {
    throw new Error('Invalid connections store: expected an object')
  }

  const record = value

  if (record.version !== 1) {
    throw new Error('Invalid connections store: unsupported version (expected 1)')
  }

  if (!Array.isArray(record.connections)) {
    throw new Error('Invalid connections store: connections must be an array')
  }

  const connections: StoredConnection[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  for (let index = 0; index < record.connections.length; index++) {
    const entry = record.connections[index]
    const connection = validateStoredConnection(entry, ` (connections[${index}])`)
    if (seenIds.has(connection.id)) {
      throw new Error(`Invalid connections store: duplicate id ${connection.id}`)
    }
    const normalizedName = connection.name.toLowerCase()
    if (seenNames.has(normalizedName)) {
      throw new Error(`Invalid connections store: duplicate name ${connection.name}`)
    }
    seenIds.add(connection.id)
    seenNames.add(normalizedName)
    connections.push(connection)
  }

  return { version: 1, connections }
}

export function toConnectionProfile(connection: StoredConnection): ConnectionProfile {
  return {
    id: connection.id,
    name: connection.name,
    hostLabel: connection.hostLabel,
    tags: connection.tags.slice(),
    createdAt: connection.createdAt,
  }
}

function validateStoredConnection(value: unknown, locationSuffix: string): StoredConnection {
  if (!isRecord(value)) {
    throw new Error(`Invalid connection${locationSuffix}: expected an object`)
  }

  const record = value
  const id = requireNonEmptyString(record.id, 'id', locationSuffix)
  const name = requireNonEmptyString(record.name, 'name', locationSuffix)
  const hostLabel = requireNonEmptyString(record.hostLabel, 'hostLabel', locationSuffix)
  const createdAt = requireNonEmptyString(record.createdAt, 'createdAt', locationSuffix)
  const uri = requireNonEmptyString(record.uri, 'uri', locationSuffix)

  if (!Array.isArray(record.tags) || record.tags.some((tag) => typeof tag !== 'string')) {
    throw new Error(`Invalid connection${locationSuffix}: tags must be an array of strings`)
  }

  return {
    id,
    name,
    hostLabel,
    tags: record.tags.slice(),
    createdAt,
    uri,
  }
}

function requireNonEmptyString(value: unknown, field: string, locationSuffix: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid connection${locationSuffix}: ${field} must be a non-empty string`)
  }
  return value
}
