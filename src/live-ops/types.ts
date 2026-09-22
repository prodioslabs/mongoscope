import type { PanelError, PanelErrorKind } from '../lib/panel-error'

export type LiveOpsPanelErrorKind = PanelErrorKind
export type LiveOpsPanelError = PanelError

export type CurrentOpRow = {
  opid: string
  namespace: string
  op: string
  /** Normalized plan label — `COLLSCAN`, `IXSCAN`, `IXSCAN+SORT`, or `n/a`. */
  plan: string
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

/** Interval activity for one namespace — milliseconds only. */
export type CollectionTopRow = {
  namespace: string
  readMs: number
  writeMs: number
  totalMs: number
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
  collectionTop: CollectionTopRow[]
  /** True until the second successful top sample establishes a delta baseline. */
  collectionTopBaselinePending: boolean
  errors: {
    currentOp: LiveOpsPanelError | null
    serverStatus: LiveOpsPanelError | null
    top: LiveOpsPanelError | null
  }
}

export type KillOpFailureReason =
  | 'permission'
  | 'not_found'
  | 'not_connected'
  | 'sharded_write'
  | 'unknown'

export type KillOpResult =
  | { ok: true }
  | { ok: false; reason: KillOpFailureReason; message: string }

/** Frozen snapshot of a row at kill-confirm open time. */
export type KillOpTarget = {
  opid: string
  namespace: string
  op: string
  plan: string
  client: string
  runningMs: number
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
  planSummary?: unknown
  cursor?: { planSummary?: unknown }
}
