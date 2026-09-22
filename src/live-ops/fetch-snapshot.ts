import type { MongoDbClient } from '../live-connection'
import { normalizeCurrentOpDocs, parseServerStatus } from './normalize'
import { panelErrorFromUnknown } from './permissions'
import { parseTopCommandResult } from './collection-top'
import type { LiveOpsPanelError, LiveOpsSnapshot, TopSample } from './types'

export type LiveOpsAdminClient = MongoDbClient

export type FetchLiveOpsSnapshotResult = {
  snapshot: LiveOpsSnapshot
  /** Raw cumulative top sample for delta computation on the next poll. */
  topSample: TopSample | null
}

/**
 * Fetch currentOp + serverStatus + top with per-panel failure isolation.
 */
export async function fetchLiveOpsSnapshot(
  client: LiveOpsAdminClient,
): Promise<FetchLiveOpsSnapshotResult> {
  const [currentOpResult, serverStatusResult, topResult] = await Promise.allSettled([
    fetchCurrentOpDocs(client),
    client.db('admin').admin().command({ serverStatus: 1 }),
    client.db('admin').admin().command({ top: 1 }),
  ])

  const errors: LiveOpsSnapshot['errors'] = {
    currentOp: null,
    serverStatus: null,
    top: null,
  }

  let ops: LiveOpsSnapshot['ops'] = []
  let ownOpsOnly = false
  let lockNote = ''
  let lockWaits: LiveOpsSnapshot['lockWaits'] = []

  if (currentOpResult.status === 'fulfilled') {
    const normalized = normalizeCurrentOpDocs(currentOpResult.value.docs)
    ops = normalized.ops
    lockNote = normalized.lockNote
    lockWaits = normalized.lockWaits
    ownOpsOnly = currentOpResult.value.ownOpsOnly
  } else {
    errors.currentOp = toCurrentOpPanelError(currentOpResult.reason)
  }

  let connections: LiveOpsSnapshot['connections'] = null
  let queuedOps: LiveOpsSnapshot['queuedOps'] = null
  if (serverStatusResult.status === 'fulfilled') {
    const parsed = parseServerStatus(serverStatusResult.value)
    connections = parsed.connections
    queuedOps = parsed.queuedOps
  } else {
    errors.serverStatus = toServerStatusPanelError(serverStatusResult.reason)
  }

  let topSample: TopSample | null = null
  if (topResult.status === 'fulfilled') {
    topSample = parseTopCommandResult(topResult.value)
  } else {
    errors.top = toTopPanelError(topResult.reason)
  }

  return {
    snapshot: {
      ops,
      ownOpsOnly,
      lockNote,
      lockWaits,
      connections,
      queuedOps,
      collectionTop: [],
      collectionTopBaselinePending: true,
      errors,
    },
    topSample,
  }
}

async function fetchCurrentOpDocs(client: LiveOpsAdminClient): Promise<{
  docs: unknown[]
  ownOpsOnly: boolean
}> {
  try {
    const docs = await runCurrentOp(client, true)
    return { docs, ownOpsOnly: false }
  } catch (error) {
    const panel = panelErrorFromUnknown(error)
    if (panel.kind !== 'permission') {
      throw error
    }
    const docs = await runCurrentOp(client, false)
    return { docs, ownOpsOnly: true }
  }
}

async function runCurrentOp(client: LiveOpsAdminClient, allUsers: boolean): Promise<unknown[]> {
  const cursor = client.db('admin').aggregate([
    {
      $currentOp: {
        allUsers,
        idleConnections: false,
      },
    },
  ])
  return cursor.toArray()
}

function toCurrentOpPanelError(reason: unknown): LiveOpsPanelError {
  const mapped = panelErrorFromUnknown(reason)
  if (mapped.kind === 'permission') {
    return {
      kind: 'permission',
      message: 'insufficient permissions (needs inprog / clusterMonitor)',
    }
  }
  return { kind: mapped.kind, message: mapped.message }
}

function toServerStatusPanelError(reason: unknown): LiveOpsPanelError {
  const mapped = panelErrorFromUnknown(reason)
  if (mapped.kind === 'permission') {
    return {
      kind: 'permission',
      message: 'insufficient permissions',
    }
  }
  return { kind: mapped.kind, message: mapped.message }
}

function toTopPanelError(reason: unknown): LiveOpsPanelError {
  const mapped = panelErrorFromUnknown(reason)
  if (mapped.kind === 'permission') {
    return {
      kind: 'permission',
      message: 'insufficient permissions',
    }
  }
  if (mapped.kind === 'unavailable') {
    return {
      kind: 'unavailable',
      message: 'top unavailable',
    }
  }
  return { kind: mapped.kind, message: mapped.message }
}
