import { normalizePlanSummary } from '../lib/plan-summary'
import { isRecord } from '../lib/is-record'
import type {
  ConnectionStats,
  CurrentOpRow,
  LockWaitCount,
  QueuedOpsStats,
  RawCurrentOpDoc,
} from './types'

const EMPTY_CELL = '—'

export function normalizeCurrentOpDocs(docs: unknown[]): {
  ops: CurrentOpRow[]
  lockWaits: LockWaitCount[]
  lockNote: string
} {
  const rawOps: RawCurrentOpDoc[] = []
  for (const doc of docs) {
    if (doc == null || typeof doc !== 'object') {
      continue
    }
    rawOps.push(doc as RawCurrentOpDoc)
  }

  const ops: CurrentOpRow[] = []
  for (const doc of rawOps) {
    if (doc.active !== true && doc.waitingForLock !== true) {
      continue
    }
    // Skip idle/system noise without an op type when inactive
    if (doc.op == null && doc.waitingForLock !== true) {
      continue
    }
    ops.push(toCurrentOpRow(doc))
  }

  ops.sort(function compareByRunningDesc(a, b) {
    return b.runningMs - a.runningMs
  })

  return {
    ops,
    lockWaits: buildLockWaits(ops),
    lockNote: buildLockNote(ops),
  }
}

function toCurrentOpRow(doc: RawCurrentOpDoc): CurrentOpRow {
  const waitingForLock = doc.waitingForLock === true
  return {
    opid: formatOpid(doc.opid),
    namespace: stringOrEmpty(doc.ns) || EMPTY_CELL,
    op: stringOrEmpty(doc.op) || EMPTY_CELL,
    plan: planFromDoc(doc),
    runningMs: runningMsFromDoc(doc),
    lock: waitingForLock ? EMPTY_CELL : formatLocks(doc.locks),
    waitingFor: waitingForLock ? formatLocks(doc.locks) : EMPTY_CELL,
    client: formatClient(doc),
    waitingForLock,
  }
}

function buildLockWaits(ops: CurrentOpRow[]): LockWaitCount[] {
  const counts = new Map<string, number>()
  for (const op of ops) {
    if (!op.waitingForLock) {
      continue
    }
    const ns = op.namespace === EMPTY_CELL ? '(unknown)' : op.namespace
    counts.set(ns, (counts.get(ns) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(function toLockWait([namespace, count]) {
      return { namespace, count }
    })
    .sort(function compareByCountDesc(a, b) {
      return b.count - a.count
    })
}

/**
 * Heuristic note: MongoDB does not expose a blocker graph.
 * Pair longest waiter with longest non-waiting op on the same namespace.
 */
export function buildLockNote(ops: CurrentOpRow[]): string {
  const waiters = ops.filter((op) => op.waitingForLock)
  if (waiters.length === 0) {
    return ''
  }

  const waitersByNs = new Map<string, CurrentOpRow[]>()
  for (const waiter of waiters) {
    const ns = waiter.namespace
    const list = waitersByNs.get(ns) ?? []
    list.push(waiter)
    waitersByNs.set(ns, list)
  }

  let bestNs = ''
  let bestWaiters: CurrentOpRow[] = []
  for (const [ns, list] of waitersByNs) {
    if (list.length > bestWaiters.length) {
      bestNs = ns
      bestWaiters = list
    }
  }

  const holders = ops.filter(
    (op) => !op.waitingForLock && op.namespace === bestNs && op.opid !== EMPTY_CELL,
  )
  holders.sort(function compareByRunningDesc(a, b) {
    return b.runningMs - a.runningMs
  })

  bestWaiters.sort(function compareByRunningDesc(a, b) {
    return b.runningMs - a.runningMs
  })

  const longestWaiter = bestWaiters[0]
  const longestHolder = holders[0]

  if (longestWaiter != null && longestHolder != null) {
    const lockLabel = longestWaiter.waitingFor !== EMPTY_CELL ? longestWaiter.waitingFor : 'lock'
    return `op ${longestWaiter.opid} is blocked waiting on ${lockLabel} lock held by op ${longestHolder.opid}`
  }

  const nsLabel = bestNs === EMPTY_CELL ? 'unknown namespace' : bestNs
  return `${bestWaiters.length} ops waiting for locks on ${nsLabel}`
}

export function parseServerStatus(result: unknown): {
  connections: ConnectionStats
  queuedOps: QueuedOpsStats
} {
  const connections: ConnectionStats = {
    current: null,
    available: null,
    active: null,
  }
  const queuedOps: QueuedOpsStats = {
    readers: null,
    writers: null,
  }

  if (result == null || typeof result !== 'object') {
    return { connections, queuedOps }
  }

  const record = result as {
    connections?: { current?: unknown; available?: unknown; active?: unknown }
    globalLock?: { currentQueue?: { readers?: unknown; writers?: unknown } }
  }

  connections.current = optionalNumber(record.connections?.current)
  connections.available = optionalNumber(record.connections?.available)
  connections.active = optionalNumber(record.connections?.active)
  queuedOps.readers = optionalNumber(record.globalLock?.currentQueue?.readers)
  queuedOps.writers = optionalNumber(record.globalLock?.currentQueue?.writers)

  return { connections, queuedOps }
}

function planFromDoc(doc: RawCurrentOpDoc): string {
  let raw: unknown = doc.planSummary
  if (typeof raw !== 'string' || raw.length === 0) {
    const cursor = doc.cursor
    if (cursor != null && typeof cursor === 'object') {
      raw = cursor.planSummary
    }
  }
  return normalizePlanSummary(raw)
}

function formatOpid(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim()
  }
  if (typeof value === 'bigint') {
    return value.toString()
  }
  return EMPTY_CELL
}

function runningMsFromDoc(doc: RawCurrentOpDoc): number {
  const micros = optionalNumber(doc.microsecs_running)
  if (micros != null) {
    return micros / 1000
  }
  const secs = optionalNumber(doc.secs_running)
  if (secs != null) {
    return secs * 1000
  }
  return 0
}

function formatLocks(locks: unknown): string {
  if (!isRecord(locks)) {
    return EMPTY_CELL
  }
  const parts: string[] = []
  for (const [lockType, mode] of Object.entries(locks)) {
    if (typeof mode === 'string' && mode.trim() !== '') {
      parts.push(`${lockType}:${mode}`)
    }
  }
  if (parts.length === 0) {
    return EMPTY_CELL
  }
  return parts.join(',')
}

function formatClient(doc: RawCurrentOpDoc): string {
  const client = stringOrEmpty(doc.client)
  if (client !== '') {
    return client
  }
  const clientS = stringOrEmpty(doc.client_s)
  if (clientS !== '') {
    return clientS
  }
  const appName = stringOrEmpty(doc.appName)
  if (appName !== '') {
    return appName
  }
  return EMPTY_CELL
}

function stringOrEmpty(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  return ''
}

function optionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'bigint') {
    return Number(value)
  }
  if (value != null && typeof value === 'object' && 'toNumber' in value) {
    const maybe = (value as { toNumber: () => number }).toNumber()
    if (typeof maybe === 'number' && Number.isFinite(maybe)) {
      return maybe
    }
  }
  return null
}
