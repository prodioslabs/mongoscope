import type { MongoClientLike } from '../live-connection'
import { buildOplogWindow } from './oplog'
import { normalizeReplicationTopology } from './normalize'
import type { OplogWindow, ReplicationPanelError, ReplicationSnapshot, ReplicationTopology } from './types'

export type ReplicationAdminClient = Pick<MongoClientLike, 'db'>

export type FetchReplicationSnapshotResult = {
  snapshot: ReplicationSnapshot
}

/**
 * Fetch topology + oplog window with per-panel failure isolation.
 */
export async function fetchReplicationSnapshot(
  client: ReplicationAdminClient,
): Promise<FetchReplicationSnapshotResult> {
  const [statusResult, configResult, oplogResult] = await Promise.allSettled([
    client.db('admin').admin().command({ replSetGetStatus: 1 }),
    client.db('admin').admin().command({ replSetGetConfig: 1 }),
    fetchOplogWindow(client),
  ])

  const errors: ReplicationSnapshot['errors'] = {
    topology: null,
    oplog: null,
  }

  let topology: ReplicationTopology | null = null
  if (statusResult.status === 'fulfilled' && configResult.status === 'fulfilled') {
    topology = normalizeReplicationTopology(statusResult.value, configResult.value)
  } else if (statusResult.status === 'fulfilled') {
    // Status alone still yields roles/lag; priority/votes stay null.
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

  let oplog: OplogWindow | null = null
  if (oplogResult.status === 'fulfilled') {
    oplog = oplogResult.value
  } else {
    errors.oplog = toOplogPanelError(oplogResult.reason)
  }

  return {
    snapshot: {
      topology,
      oplog,
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
