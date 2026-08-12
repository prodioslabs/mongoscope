export type ConnectionProfile = {
  id: string
  name: string
  hostLabel: string
  tags: string[]
  createdAt: string
}

export type ConnectionsFile = {
  version: 1
  connections: ConnectionProfile[]
}
