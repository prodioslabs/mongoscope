import type { MongoClientLike } from '../live-connection'
import { isUnauthorizedError } from './permissions'
import type { KillOpResult } from './types'

const EMPTY_OPID = '—'

export function parseKillOpid(opid: string): number | null {
  if (opid === EMPTY_OPID || opid.trim() === '') {
    return null
  }
  const parsed = Number(opid)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return parsed
}

export async function killCurrentOp(
  client: MongoClientLike | null,
  opid: number,
): Promise<KillOpResult> {
  if (client == null) {
    return {
      ok: false,
      reason: 'not_connected',
      message: 'not connected',
    }
  }

  try {
    await client.db('admin').admin().command({ killOp: 1, op: opid })
    return { ok: true }
  } catch (error) {
    return mapKillOpError(error)
  }
}

export function mapKillOpError(error: unknown): Extract<KillOpResult, { ok: false }> {
  if (isUnauthorizedError(error)) {
    return {
      ok: false,
      reason: 'permission',
      message: "insufficient permissions (needs killop to kill other users' operations)",
    }
  }

  const message = errorMessage(error).toLowerCase()

  if (
    message.includes('no such operation') ||
    message.includes('not found') ||
    message.includes('unknown op') ||
    message.includes('already finished') ||
    message.includes('operation not found')
  ) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'operation already finished',
    }
  }

  if (
    message.includes('mongos') &&
    (message.includes('write') || message.includes('session') || message.includes('kill'))
  ) {
    return {
      ok: false,
      reason: 'sharded_write',
      message: 'could not kill operation (sharded write)',
    }
  }

  return {
    ok: false,
    reason: 'unknown',
    message: 'could not kill operation',
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (error != null && typeof error === 'object' && 'message' in error) {
    const maybe = (error as { message: unknown }).message
    if (typeof maybe === 'string') {
      return maybe
    }
  }
  return String(error)
}
