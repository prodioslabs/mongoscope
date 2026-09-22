import { Timestamp } from 'mongodb'
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
    return finiteNumber(ts.getHighBits())
  }

  if ('getHighBits' in ts && typeof (ts as { getHighBits: unknown }).getHighBits === 'function') {
    const high = (ts as { getHighBits: () => unknown }).getHighBits()
    return finiteNumber(high)
  }

  if ('$timestamp' in ts) {
    const wrapped = (ts as { $timestamp?: unknown }).$timestamp
    if (wrapped != null && typeof wrapped === 'object' && 't' in wrapped) {
      return finiteNumber((wrapped as { t: unknown }).t)
    }
  }

  if ('t' in ts) {
    return finiteNumber((ts as { t: unknown }).t)
  }

  return null
}

export function buildOplogWindow(
  stats: OplogStatsInput | null | undefined,
  first: OplogEdgeDoc,
  last: OplogEdgeDoc,
): OplogWindow {
  const usedBytes = Math.max(0, finiteNumber(stats?.size) ?? 0)
  const maxBytes = Math.max(0, finiteNumber(stats?.maxSize) ?? 0)

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

function finiteNumber(value: unknown): number | null {
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
