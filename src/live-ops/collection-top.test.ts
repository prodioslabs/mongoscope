import { describe, expect, it } from 'vitest'
import {
  buildCollectionTopRows,
  computeCollectionTopScale,
  formatTopTimeLabel,
  microsToMs,
  parseTopCommandResult,
} from './collection-top'

describe('parseTopCommandResult', () => {
  it('parses readLock/writeLock times in microseconds and skips the note key', () => {
    const sample = parseTopCommandResult({
      totals: {
        note: 'all times in microseconds',
        'app.users': {
          total: { time: 12_000, count: 3 },
          readLock: { time: 10_000, count: 2 },
          writeLock: { time: 2_000, count: 1 },
          queries: { time: 10_000, count: 2 },
        },
      },
    })

    expect(sample.byNamespace['app.users']).toEqual({
      readLockMicros: 10_000,
      writeLockMicros: 2_000,
    })
    expect(sample.byNamespace.note).toBeUndefined()
  })

  it('handles missing writeLock and empty totals', () => {
    expect(parseTopCommandResult(null).byNamespace).toEqual({})
    expect(parseTopCommandResult({ totals: {} }).byNamespace).toEqual({})
    const sample = parseTopCommandResult({
      totals: {
        'db.coll': { readLock: { time: 500 } },
      },
    })
    expect(sample.byNamespace['db.coll']).toEqual({
      readLockMicros: 500,
      writeLockMicros: 0,
    })
  })
})

describe('microsToMs', () => {
  it('converts microseconds to milliseconds exactly once', () => {
    expect(microsToMs(13_864_300)).toBe(13_864.3)
    expect(microsToMs(296_000)).toBe(296)
  })
})

describe('formatTopTimeLabel', () => {
  it('formats sub-second totals as ms', () => {
    expect(formatTopTimeLabel(296)).toBe('296ms')
    expect(formatTopTimeLabel(29)).toBe('29ms')
  })

  it('formats second-scale totals with one decimal place', () => {
    expect(formatTopTimeLabel(13_864.3)).toBe('13.9s')
  })

  it('documents the screenshot bug signature when micros are stored as ms', () => {
    const buggyMs = 13_864_300
    expect(formatTopTimeLabel(buggyMs)).toBe('13864.3s')
    expect(formatTopTimeLabel(microsToMs(13_864_300))).toBe('13.9s')
  })
})

describe('buildCollectionTopRows', () => {
  it('returns baseline state on the first sample', () => {
    const current = parseTopCommandResult({
      totals: {
        'app.users': { readLock: { time: 1000 }, writeLock: { time: 0 } },
      },
    })
    expect(buildCollectionTopRows(null, current)).toEqual({
      rows: [],
      sample: current,
      isBaseline: true,
    })
  })

  it('diffs consecutive samples into milliseconds sorted by totalMs desc', () => {
    const previous = parseTopCommandResult({
      totals: {
        'app.users': { readLock: { time: 1_000 }, writeLock: { time: 500 } },
        'app.orders': { readLock: { time: 0 }, writeLock: { time: 0 } },
      },
    })
    const current = parseTopCommandResult({
      totals: {
        'app.users': { readLock: { time: 3_000 }, writeLock: { time: 1_500 } },
        'app.orders': { readLock: { time: 10_000 }, writeLock: { time: 0 } },
      },
    })

    expect(buildCollectionTopRows(previous, current)).toEqual({
      rows: [
        {
          namespace: 'app.orders',
          readMs: 10,
          writeMs: 0,
          totalMs: 10,
        },
        {
          namespace: 'app.users',
          readMs: 2,
          writeMs: 1,
          totalMs: 3,
        },
      ],
      sample: current,
      isBaseline: false,
    })
  })

  it('clamps negative deltas after counter reset', () => {
    const previous = parseTopCommandResult({
      totals: {
        'app.users': { readLock: { time: 5_000 }, writeLock: { time: 0 } },
      },
    })
    const current = parseTopCommandResult({
      totals: {
        'app.users': { readLock: { time: 100 }, writeLock: { time: 0 } },
      },
    })
    expect(buildCollectionTopRows(previous, current)).toEqual({
      rows: [],
      sample: current,
      isBaseline: false,
    })
  })

  it('includes namespaces that appear only in the current sample', () => {
    const previous = parseTopCommandResult({
      totals: {
        'app.old': { readLock: { time: 0 }, writeLock: { time: 0 } },
      },
    })
    const current = parseTopCommandResult({
      totals: {
        'app.new': { readLock: { time: 5_000 }, writeLock: { time: 0 } },
      },
    })
    expect(buildCollectionTopRows(previous, current).rows).toEqual([
      { namespace: 'app.new', readMs: 5, writeMs: 0, totalMs: 5 },
    ])
  })

  it('converts screenshot-scale microsecond deltas to milliseconds (Bug 2 regression)', () => {
    const previous = parseTopCommandResult({
      totals: {
        'ucc-production.Form': { readLock: { time: 0 }, writeLock: { time: 0 } },
        'ucc-production.User': { readLock: { time: 0 }, writeLock: { time: 0 } },
        'ucc-production.Service': { readLock: { time: 0 }, writeLock: { time: 0 } },
        'local.oplog.rs': { readLock: { time: 0 }, writeLock: { time: 0 } },
        'ucc-production.Session': { readLock: { time: 0 }, writeLock: { time: 0 } },
        'config.system.sessions': { readLock: { time: 0 }, writeLock: { time: 0 } },
      },
    })
    const current = parseTopCommandResult({
      totals: {
        'ucc-production.Form': { readLock: { time: 13_864_300 }, writeLock: { time: 0 } },
        'ucc-production.User': { readLock: { time: 296_000 }, writeLock: { time: 0 } },
        'ucc-production.Service': { readLock: { time: 29_000 }, writeLock: { time: 0 } },
        'local.oplog.rs': { readLock: { time: 15_000 }, writeLock: { time: 0 } },
        'ucc-production.Session': { readLock: { time: 14_000 }, writeLock: { time: 0 } },
        'config.system.sessions': { readLock: { time: 6_000 }, writeLock: { time: 0 } },
      },
    })

    const { rows } = buildCollectionTopRows(previous, current)
    const form = rows.find((row) => row.namespace === 'ucc-production.Form')
    const user = rows.find((row) => row.namespace === 'ucc-production.User')

    expect(form).toEqual({
      namespace: 'ucc-production.Form',
      readMs: 13_864.3,
      writeMs: 0,
      totalMs: 13_864.3,
    })
    expect(user).toEqual({
      namespace: 'ucc-production.User',
      readMs: 296,
      writeMs: 0,
      totalMs: 296,
    })
    expect(formatTopTimeLabel(form!.totalMs)).toBe('13.9s')
    expect(formatTopTimeLabel(user!.totalMs)).toBe('296ms')
  })
})

describe('computeCollectionTopScale', () => {
  const normalizedRows = [
    { namespace: 'ucc-production.Form', readMs: 13_864.3, writeMs: 0, totalMs: 13_864.3 },
    { namespace: 'ucc-production.User', readMs: 296, writeMs: 0, totalMs: 296 },
    { namespace: 'ucc-production.Service', readMs: 29, writeMs: 0, totalMs: 29 },
    { namespace: 'local.oplog.rs', readMs: 15, writeMs: 0, totalMs: 15 },
    { namespace: 'ucc-production.Session', readMs: 14, writeMs: 0, totalMs: 14 },
    { namespace: 'config.system.sessions', readMs: 6, writeMs: 0, totalMs: 6 },
  ]

  it('sets maxTotalMs from the busiest row and max row fillPercent is exactly 100', () => {
    const scale = computeCollectionTopScale(normalizedRows)
    expect(scale.maxTotalMs).toBe(13_864.3)
    const maxRows = scale.rows.filter((row) => row.fillPercent === 100)
    expect(maxRows).toHaveLength(1)
    expect(maxRows[0]?.namespace).toBe('ucc-production.Form')
  })

  it('computes fillPercent from the same millisecond unit for every row', () => {
    const scale = computeCollectionTopScale(normalizedRows)
    const user = scale.rows.find((row) => row.namespace === 'ucc-production.User')
    expect(user?.fillPercent).toBeCloseTo((296 / 13_864.3) * 100, 5)
    expect(user?.readSharePercent).toBe(100)
  })

  it('gives fillPercent 100 with readSharePercent below 100 for mixed read/write max row', () => {
    const mixedRows = [
      { namespace: 'db.coll', readMs: 600, writeMs: 400, totalMs: 1000 },
      { namespace: 'db.other', readMs: 100, writeMs: 0, totalMs: 100 },
    ]
    const scale = computeCollectionTopScale(mixedRows)
    const maxRow = scale.rows[0]
    expect(maxRow?.fillPercent).toBe(100)
    expect(maxRow?.readSharePercent).toBe(60)
  })

  it('returns empty scale for zero rows', () => {
    expect(computeCollectionTopScale([])).toEqual({ maxTotalMs: 0, rows: [] })
  })

  it('returns fillPercent 100 for a single row', () => {
    const scale = computeCollectionTopScale([
      { namespace: 'solo', readMs: 50, writeMs: 0, totalMs: 50 },
    ])
    expect(scale.rows[0]?.fillPercent).toBe(100)
  })
})
