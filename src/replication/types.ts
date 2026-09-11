export type ReplicationPanelErrorKind = 'permission' | 'unavailable' | 'unknown'

export type ReplicationPanelError = {
  kind: ReplicationPanelErrorKind
  message: string
}

/** Status-dot severity for a topology member. */
export type MemberSeverity = 'success' | 'warning' | 'error'

export type TopologyMember = {
  id: number
  name: string
  host: string
  stateStr: string
  health: number
  priority: number | null
  votes: number | null
  /** Seconds behind primary optimeDate; 0 for primary; null when unknown. */
  lagSeconds: number | null
  severity: MemberSeverity
  self: boolean
}

export type ReplicationTopology = {
  setName: string | null
  members: TopologyMember[]
}

export type OplogWindow = {
  usedBytes: number
  maxBytes: number
  windowSeconds: number | null
  windowHours: number | null
  growthBytesPerHour: number | null
  /** Clamped 0–100 for progress bars. */
  fillPercent: number
  /** True when usedBytes exceeds configured maxSize. */
  fillsOverMax: boolean
}

/** Heartbeat RTT as observed from the connected member only (not a full matrix). */
export type HeartbeatEdge = {
  fromName: string
  toName: string
  pingMs: number
}

export type HeartbeatsView = {
  fromName: string
  edges: HeartbeatEdge[]
}

/** One replication-relevant line from the server RAM log ring. */
export type RecentReplicationEvent = {
  timestampMs: number | null
  timestampLabel: string
  message: string
  component: string
}

export type WriteConcernView = {
  /** e.g. `majority`, `1`, or null when unset/implicit. */
  defaultW: string | null
  source: string | null
}

export type ReplicationSnapshot = {
  topology: ReplicationTopology | null
  oplog: OplogWindow | null
  heartbeats: HeartbeatsView | null
  recentEvents: RecentReplicationEvent[]
  writeConcern: WriteConcernView | null
  errors: {
    topology: ReplicationPanelError | null
    oplog: ReplicationPanelError | null
    heartbeats: ReplicationPanelError | null
    recentEvents: ReplicationPanelError | null
    writeConcern: ReplicationPanelError | null
  }
}
