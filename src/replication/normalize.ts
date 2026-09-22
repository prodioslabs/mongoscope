import type { MemberSeverity, ReplicationTopology, TopologyMember } from './types'

/** Lag at or above this many seconds marks a reachable secondary as warning. */
export const LAG_WARNING_SECONDS = 10

const SUCCESS_STATES = new Set(['PRIMARY', 'SECONDARY', 'ARBITER'])
const WARNING_STATES = new Set(['RECOVERING', 'STARTUP', 'STARTUP2'])
const ERROR_STATES = new Set(['DOWN', 'UNKNOWN', 'ROLLBACK', 'REMOVED'])

export type RawStatusMember = {
  _id?: unknown
  name?: unknown
  health?: unknown
  state?: unknown
  stateStr?: unknown
  optimeDate?: unknown
  self?: unknown
  /** Present on remote members in replSetGetStatus (heartbeat RTT). */
  pingMs?: unknown
}

export type RawReplSetStatus = {
  set?: unknown
  members?: RawStatusMember[] | unknown
}

export type RawConfigMember = {
  _id?: unknown
  host?: unknown
  priority?: unknown
  votes?: unknown
}

export type RawReplSetConfig = {
  config?: {
    _id?: unknown
    members?: RawConfigMember[] | unknown
  } | null
}

type SeverityInput = {
  health: number
  stateStr: string
  lagSeconds: number | null
}

export function memberStatusSeverity({
  health,
  stateStr,
  lagSeconds,
}: SeverityInput): MemberSeverity {
  const state = stateStr.toUpperCase()
  if (health !== 1 || ERROR_STATES.has(state)) {
    return 'error'
  }
  if (WARNING_STATES.has(state)) {
    return 'warning'
  }
  if (
    (state === 'SECONDARY' || state === 'PRIMARY') &&
    lagSeconds != null &&
    lagSeconds >= LAG_WARNING_SECONDS
  ) {
    return 'warning'
  }
  if (SUCCESS_STATES.has(state)) {
    return 'success'
  }
  // Reachable but unfamiliar state — treat cautiously.
  return 'warning'
}

export function normalizeReplicationTopology(
  statusRaw: unknown,
  configRaw: unknown,
): ReplicationTopology {
  const status = asStatus(statusRaw)
  const configMembers = asConfigMembers(configRaw)
  const statusMembers = Array.isArray(status?.members) ? status.members : []

  const configById = new Map<number, RawConfigMember>()
  for (const member of configMembers) {
    const id = optionalInt(member._id)
    if (id != null) {
      configById.set(id, member)
    }
  }

  let primaryOptimeMs: number | null = null
  for (const member of statusMembers) {
    if (stringOrEmpty(member.stateStr).toUpperCase() !== 'PRIMARY') {
      continue
    }
    primaryOptimeMs = dateToMs(member.optimeDate)
    if (primaryOptimeMs != null) {
      break
    }
  }

  const members: TopologyMember[] = []
  for (const member of statusMembers) {
    const id = optionalInt(member._id)
    if (id == null) {
      continue
    }
    const name = stringOrEmpty(member.name) || `member-${id}`
    const config = configById.get(id)
    const host = stringOrEmpty(config?.host) || name
    const stateStr = stringOrEmpty(member.stateStr) || 'UNKNOWN'
    const health = optionalNumber(member.health) ?? 0
    const self = member.self === true
    const memberOptimeMs = dateToMs(member.optimeDate)

    let lagSeconds: number | null = null
    if (stateStr.toUpperCase() === 'PRIMARY') {
      lagSeconds = 0
    } else if (stateStr.toUpperCase() === 'ARBITER') {
      lagSeconds = null
    } else if (primaryOptimeMs != null && memberOptimeMs != null) {
      lagSeconds = Math.max(0, (primaryOptimeMs - memberOptimeMs) / 1000)
    }

    members.push({
      id,
      name,
      host,
      stateStr,
      health,
      priority: optionalNumber(config?.priority),
      votes: optionalNumber(config?.votes),
      lagSeconds,
      severity: memberStatusSeverity({ health, stateStr, lagSeconds }),
      self,
    })
  }

  members.sort(function compareById(a, b) {
    return a.id - b.id
  })

  return {
    setName: stringOrNull(status?.set),
    members,
  }
}

function asStatus(value: unknown): RawReplSetStatus | null {
  if (value == null || typeof value !== 'object') {
    return null
  }
  return value as RawReplSetStatus
}

function asConfigMembers(value: unknown): RawConfigMember[] {
  if (value == null || typeof value !== 'object') {
    return []
  }
  const config = (value as RawReplSetConfig).config
  if (config == null || typeof config !== 'object') {
    return []
  }
  return Array.isArray(config.members) ? (config.members as RawConfigMember[]) : []
}

function dateToMs(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (value != null && typeof value === 'object' && '$date' in value) {
    const raw = (value as { $date: unknown }).$date
    if (typeof raw === 'string' || typeof raw === 'number') {
      const ms = new Date(raw).getTime()
      return Number.isFinite(ms) ? ms : null
    }
  }
  return null
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

function optionalInt(value: unknown): number | null {
  const n = optionalNumber(value)
  if (n == null) {
    return null
  }
  return Math.trunc(n)
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
