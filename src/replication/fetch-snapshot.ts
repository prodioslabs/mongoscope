import type { MongoClientLike } from '../live-connection'
import { normalizeHeartbeats } from './heartbeats'
import { buildOplogWindow } from './oplog'
import { normalizeRecentReplicationEvents } from './recent-events'
import { normalizeReplicationTopology } from './normalize'
import { normalizeWriteConcern } from './write-concern'
import type {
  HeartbeatsView,
  OplogWindow,
  RecentReplicationEvent,
  ReplicationPanelError,
  ReplicationSnapshot,
  ReplicationTopology,
  WriteConcernView,
} from './types'

export type ReplicationAdminClient = Pick<MongoClientLike, 'db'>

export type FetchReplicationSnapshotResult = {
  snapshot: ReplicationSnapshot
}

/**
 * Fetch topology, oplog, heartbeats, recent REPL log lines, and default WC
 * with per-panel failure isolation.
 */
export async function fetchReplicationSnapshot(
  client: ReplicationAdminClient,
): Promise<FetchReplicationSnapshotResult> {
  const admin = client.db('admin').admin()

  const [statusResult, configResult, oplogResult, getLogResult, rwConcernResult] =
    await Promise.allSettled([
      admin.command({ replSetGetStatus: 1 }),
      admin.command({ replSetGetConfig: 1 }),
      fetchOplogWindow(client),
      admin.command({ getLog: 'global' }),
      admin.command({ getDefaultRWConcern: 1 }),
    ])

  const errors: ReplicationSnapshot['errors'] = {
    topology: null,
    oplog: null,
    heartbeats: null,
    recentEvents: null,
    writeConcern: null,
  }

  let topology: ReplicationTopology | null = null
  if (statusResult.status === 'fulfilled' && configResult.status === 'fulfilled') {
    topology = normalizeReplicationTopology(statusResult.value, configResult.value)
  } else if (statusResult.status === 'fulfilled') {
    topology = normalizeReplicationTopology(statusResult.value, null)
    errors.topology = {
      kind: 'unknown',
      message: 'replica set config unavailable — priority/votes missing',
    }
  } else {
    errors.topology = toTopologyPanelError(
      statusResult.reason,
      configResult.status === 'rejected' ? configResult.reason : undefined,
    )
  }

  let heartbeats: HeartbeatsView | null = null
  if (statusResult.status === 'fulfilled') {
    heartbeats = normalizeHeartbeats(statusResult.value)
  } else {
    errors.heartbeats = {
      kind: errors.topology?.kind ?? 'unknown',
      message:
        errors.topology?.kind === 'permission'
          ? 'insufficient permissions'
          : 'failed to load heartbeats',
    }
  }

  let oplog: OplogWindow | null = null
  if (oplogResult.status === 'fulfilled') {
    oplog = oplogResult.value
  } else {
    errors.oplog = toOplogPanelError(oplogResult.reason)
  }

  let recentEvents: RecentReplicationEvent[] = []
  if (getLogResult.status === 'fulfilled') {
    recentEvents = normalizeRecentReplicationEvents(getLogResult.value)
  } else {
    errors.recentEvents = toGetLogPanelError(getLogResult.reason)
  }

  let writeConcern: WriteConcernView | null = null
  if (rwConcernResult.status === 'fulfilled') {
    writeConcern = normalizeWriteConcern(rwConcernResult.value)
  } else {
    errors.writeConcern = toWriteConcernPanelError(rwConcernResult.reason)
  }

  return {
    snapshot: {
      topology,
      oplog,
      heartbeats,
      recentEvents,
      writeConcern,
      errors,
    },
  }
}

async function fetchOplogWindow(client: ReplicationAdminClient): Promise<OplogWindow> {
  const local = client.db('local')
  const [stats, firstDocs, lastDocs] = await Promise.all([
    local.command({ collStats: 'oplog.rs' }),
    local.collection('oplog.rs').find({}).sort({ $natural: 1 }).limit(1).toArray(),
    local.collection('oplog.rs').find({}).sort({ $natural: -1 }).limit(1).toArray(),
  ])

  const first =
    Array.isArray(firstDocs) && firstDocs.length > 0 ? (firstDocs[0] as { ts?: unknown }) : null
  const last =
    Array.isArray(lastDocs) && lastDocs.length > 0 ? (lastDocs[0] as { ts?: unknown }) : null
  return buildOplogWindow(
    stats != null && typeof stats === 'object'
      ? (stats as { size?: unknown; maxSize?: unknown })
      : null,
    first,
    last,
  )
}

function toTopologyPanelError(statusReason: unknown, configReason?: unknown): ReplicationPanelError {
  if (isUnauthorizedError(statusReason)) {
    return {
      kind: 'permission',
      message: 'insufficient permissions (needs replSetGetStatus / clusterMonitor)',
    }
  }
  if (isNotReplicaSetError(statusReason) || isNotReplicaSetError(configReason)) {
    return {
      kind: 'unavailable',
      message: 'not a replica set member',
    }
  }
  return { kind: 'unknown', message: 'failed to load topology' }
}

function toOplogPanelError(reason: unknown): ReplicationPanelError {
  if (isUnauthorizedError(reason)) {
    return {
      kind: 'permission',
      message: 'insufficient permissions (needs local.oplog.rs read)',
    }
  }
  return { kind: 'unknown', message: 'failed to load oplog window' }
}

function toGetLogPanelError(reason: unknown): ReplicationPanelError {
  if (isUnauthorizedError(reason)) {
    return {
      kind: 'permission',
      message: 'insufficient permissions (needs getLog / clusterMonitor)',
    }
  }
  return { kind: 'unknown', message: 'failed to load recent events' }
}

function toWriteConcernPanelError(reason: unknown): ReplicationPanelError {
  if (isUnauthorizedError(reason)) {
    return {
      kind: 'permission',
      message: 'insufficient permissions (needs getDefaultRWConcern)',
    }
  }
  return { kind: 'unknown', message: 'failed to load write concern' }
}

function isUnauthorizedError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false
  }
  const record = error as { code?: unknown; codeName?: unknown; message?: unknown }
  if (record.code === 13 || record.codeName === 'Unauthorized') {
    return true
  }
  const message = typeof record.message === 'string' ? record.message.toLowerCase() : ''
  return (
    message.includes('not authorized') ||
    message.includes('unauthorized') ||
    message.includes('requires authentication')
  )
}

function isNotReplicaSetError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') {
    return false
  }
  const message =
    typeof (error as { message?: unknown }).message === 'string'
      ? ((error as { message: string }).message).toLowerCase()
      : ''
  const codeName =
    typeof (error as { codeName?: unknown }).codeName === 'string'
      ? ((error as { codeName: string }).codeName).toLowerCase()
      : ''
  return (
    message.includes('not running with --replset') ||
    message.includes('no replset config') ||
    message.includes('not a member of a replica set') ||
    message.includes('no replication has been enabled') ||
    codeName.includes('notyetinitialized')
  )
}
