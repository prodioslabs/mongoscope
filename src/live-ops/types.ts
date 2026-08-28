export type LiveOpsPanelErrorKind = 'permission' | 'unavailable' | 'unknown'

export type LiveOpsPanelError = {
  kind: LiveOpsPanelErrorKind
  message: string
}

export type CurrentOpRow = {
  opid: string
  namespace: string
  op: string
  runningMs: number
  lock: string
  waitingFor: string
  client: string
  waitingForLock: boolean
}

export type LockWaitCount = {
  namespace: string
  count: number
}

export type ConnectionStats = {
  current: number | null
  available: number | null
  active: number | null
}

export type QueuedOpsStats = {
  readers: number | null
  writers: number | null
}

export type CollectionTopDelta = {
  namespace: string
  readMs: number
  writeMs: number
}

/** Cumulative per-collection lock times from `top` (microseconds). */
export type TopSample = {
  byNamespace: Record<string, { readLockMicros: number; writeLockMicros: number }>
}

export type LiveOpsSnapshot = {
  ops: CurrentOpRow[]
  ownOpsOnly: boolean
  lockNote: string
  lockWaits: LockWaitCount[]
  connections: ConnectionStats | null
  queuedOps: QueuedOpsStats | null
  collectionTop: CollectionTopDelta[]
  errors: {
    currentOp: LiveOpsPanelError | null
    serverStatus: LiveOpsPanelError | null
    top: LiveOpsPanelError | null
  }
}

export type RawCurrentOpDoc = {
  opid?: unknown
  ns?: unknown
  op?: unknown
  active?: unknown
  microsecs_running?: unknown
  secs_running?: unknown
  locks?: unknown
  waitingForLock?: unknown
  client?: unknown
  client_s?: unknown
  appName?: unknown
  type?: unknown
}
