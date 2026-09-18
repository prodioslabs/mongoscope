import type { HeartbeatEdge, HeartbeatsView } from './types'

type RawStatusMember = {
  _id?: unknown
  name?: unknown
  self?: unknown
  pingMs?: unknown
}

type RawReplSetStatus = {
  members?: RawStatusMember[] | unknown
}

/**
 * Build heartbeats observed from the member that processed replSetGetStatus.
 * `pingMs` is only present for remote members — this is intentionally not a full matrix.
 */
export function normalizeHeartbeats(statusRaw: unknown): HeartbeatsView | null {
  if (statusRaw == null || typeof statusRaw !== 'object') {
    return null
  }
  const members = Array.isArray((statusRaw as RawReplSetStatus).members)
    ? ((statusRaw as RawReplSetStatus).members as RawStatusMember[])
    : []

  let fromName: string | null = null
  for (const member of members) {
    if (member.self === true) {
      fromName = stringOrEmpty(member.name) || 'self'
      break
    }
  }
  if (fromName == null) {
    // Secondary views still list members; fall back to first name if self flag absent.
    fromName = stringOrEmpty(members[0]?.name) || 'this node'
  }

  const edges: HeartbeatEdge[] = []
  for (const member of members) {
    if (member.self === true) {
      continue
    }
    const pingMs = optionalNumber(member.pingMs)
    if (pingMs == null) {
      continue
    }
    const toName = stringOrEmpty(member.name)
    if (toName === '') {
      continue
    }
    edges.push({ fromName, toName, pingMs })
  }

  edges.sort(function compareByPing(a, b) {
    return a.pingMs - b.pingMs
  })

  return { fromName, edges }
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : ''
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
