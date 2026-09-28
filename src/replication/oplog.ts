import { Timestamp } from 'mongodb'
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
  if (ts == null || typeof ts !== 'object') {
    return null
  }

  if (ts instanceof Timestamp) {
    return optionalNumber(ts.getHighBits())
  }

  if ('getHighBits' in ts && typeof (ts as { getHighBits: unknown }).getHighBits === 'function') {
    const high = (ts as { getHighBits: () => unknown }).getHighBits()
    return optionalNumber(high)
  }

  if ('$timestamp' in ts) {
    const wrapped = (ts as { $timestamp?: unknown }).$timestamp
    if (wrapped != null && typeof wrapped === 'object' && 't' in wrapped) {
      return optionalNumber((wrapped as { t: unknown }).t)
    }
  }

  if ('t' in ts) {
    return optionalNumber((ts as { t: unknown }).t)
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
