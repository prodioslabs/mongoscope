import { describe, expect, it } from 'vitest'
import {
  buildOplogWindow,
  oplogTimestampSeconds,
  type OplogEdgeDoc,
  type OplogStatsInput,
} from './oplog'

describe('oplogTimestampSeconds', () => {
  it('reads BSON Timestamp-like { t, i } and extended JSON', () => {
    expect(oplogTimestampSeconds({ t: 1_700_000_000, i: 1 })).toBe(1_700_000_000)
    expect(oplogTimestampSeconds({ $timestamp: { t: 1_700_000_100, i: 2 } })).toBe(1_700_000_100)
  })

  it('reads driver Timestamp getHighBits()', () => {
    expect(
      oplogTimestampSeconds({
        getHighBits() {
          return 1_700_000_200
        },
        getLowBits() {
          return 1
        },
      }),
    ).toBe(1_700_000_200)
  })

  it('returns null for missing or invalid timestamps', () => {
    expect(oplogTimestampSeconds(null)).toBeNull()
    expect(oplogTimestampSeconds({})).toBeNull()
    expect(oplogTimestampSeconds({ t: 'nope' })).toBeNull()
  })
})

describe('buildOplogWindow', () => {
  const stats: OplogStatsInput = {
    size: 104_857_600, // 100 MiB used
    maxSize: 524_288_000, // 500 MiB configured
  }
  const first: OplogEdgeDoc = { ts: { t: 1_700_000_000, i: 1 } }
  const last: OplogEdgeDoc = { ts: { t: 1_700_086_400, i: 1 } } // +24h

  it('computes window hours, fill percent, and growth rate from a single snapshot', () => {
    const oplogWindow = buildOplogWindow(stats, first, last)
    expect(oplogWindow).toEqual({
      usedBytes: 104_857_600,
      maxBytes: 524_288_000,
      windowSeconds: 86_400,
      windowHours: 24,
      growthBytesPerHour: 104_857_600 / 24,
      fillPercent: (104_857_600 / 524_288_000) * 100,
      fillsOverMax: false,
    })
  })

  it('clamps fillPercent display to 100 when oplog exceeds configured maxSize', () => {
    const oplogWindow = buildOplogWindow({ size: 600_000_000, maxSize: 500_000_000 }, first, last)
    expect(oplogWindow.usedBytes).toBe(600_000_000)
    expect(oplogWindow.maxBytes).toBe(500_000_000)
    expect(oplogWindow.fillsOverMax).toBe(true)
    expect(oplogWindow.fillPercent).toBe(100)
  })

  it('returns null window/growth when edges are missing or unordered', () => {
    expect(buildOplogWindow(stats, null, last).windowHours).toBeNull()
    expect(buildOplogWindow(stats, first, null).growthBytesPerHour).toBeNull()
    expect(
      buildOplogWindow(stats, { ts: { t: 100, i: 1 } }, { ts: { t: 50, i: 1 } }).windowSeconds,
    ).toBeNull()
  })

  it('handles zero/missing maxSize without dividing by zero', () => {
    const oplogWindow = buildOplogWindow({ size: 1000, maxSize: 0 }, first, last)
    expect(oplogWindow.fillPercent).toBe(0)
    expect(oplogWindow.maxBytes).toBe(0)
  })
})
