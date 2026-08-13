export type ConnectionProfile = {
  id: string
  name: string
  hostLabel: string
  tags: string[]
  createdAt: string
}

/** Full connection record as stored in the OS keychain blob (includes URI). */
export type StoredConnection = ConnectionProfile & {
  uri: string
}

export type ConnectionsBlob = {
  version: 1
  connections: StoredConnection[]
}
