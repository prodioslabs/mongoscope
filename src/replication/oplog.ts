import { Timestamp } from 'mongodb'
import { isRecord } from '../lib/is-record'
import { optionalNumber } from '../lib/optional-number'
import type { OplogWindow } from './types'

export type OplogStatsInput = {
  size?: unknown
  maxSize?: unknown
}

export type OplogEdgeDoc = {
  ts?: unknown
} | null

/**
 * Extract the seconds component from an oplog BSON Timestamp-like value.
 * Matches mongosh `DB.tsToSeconds` semantics used by `db.getReplicationInfo()`.
 */
export function oplogTimestampSeconds(ts: unknown): number | null {
  if (ts instanceof Timestamp) {
    return optionalNumber(ts.getHighBits())
  }

  if (!isRecord(ts)) {
    return null
  }

  const getHighBits = ts.getHighBits
  if (typeof getHighBits === 'function') {
    const high: unknown = getHighBits.call(ts)
    return optionalNumber(high)
  }

  if (isRecord(ts.$timestamp) && 't' in ts.$timestamp) {
    return optionalNumber(ts.$timestamp.t)
  }

  if ('t' in ts) {
    return optionalNumber(ts.t)
  }

  return null
}

export function buildOplogWindow(
  stats: OplogStatsInput | null | undefined,
  first: OplogEdgeDoc,
  last: OplogEdgeDoc,
): OplogWindow {
  const usedBytes = Math.max(0, optionalNumber(stats?.size) ?? 0)
  const maxBytes = Math.max(0, optionalNumber(stats?.maxSize) ?? 0)

  const tFirst = first != null ? oplogTimestampSeconds(first.ts) : null
  const tLast = last != null ? oplogTimestampSeconds(last.ts) : null

  let windowSeconds: number | null = null
  if (tFirst != null && tLast != null && tLast >= tFirst) {
    windowSeconds = tLast - tFirst
  }

  const windowHours = windowSeconds != null ? windowSeconds / 3600 : null
  const growthBytesPerHour = windowHours != null && windowHours > 0 ? usedBytes / windowHours : null

  const fillsOverMax = maxBytes > 0 && usedBytes > maxBytes
  let fillPercent = 0
  if (maxBytes > 0) {
    fillPercent = Math.min(100, (usedBytes / maxBytes) * 100)
  }

  return {
    usedBytes,
    maxBytes,
    windowSeconds,
    windowHours,
    growthBytesPerHour,
    fillPercent,
    fillsOverMax,
  }
}
