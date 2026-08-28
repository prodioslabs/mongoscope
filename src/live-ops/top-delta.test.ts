import { describe, expect, it } from 'vitest'
import { computeTopDeltas, parseTopCommandResult } from './top-delta'

describe('parseTopCommandResult', () => {
  it('parses readLock/writeLock times and skips the note key', () => {
    const sample = parseTopCommandResult({
      totals: {
        note: 'all times in microseconds',
        'app.users': {
          readLock: { time: 10_000, count: 2 },
          writeLock: { time: 2_000, count: 1 },
        },
      },
    })

    expect(sample.byNamespace['app.users']).toEqual({
      readLockMicros: 10_000,
      writeLockMicros: 2_000,
    })
    expect(sample.byNamespace.note).toBeUndefined()
  })
})

describe('computeTopDeltas', () => {
  it('returns empty on the first sample', () => {
    const current = parseTopCommandResult({
      totals: {
        'app.users': { readLock: { time: 1000 }, writeLock: { time: 0 } },
      },
    })
    expect(computeTopDeltas(null, current)).toEqual([])
  })

  it('diffs consecutive samples into milliseconds sorted by total', () => {
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

    expect(computeTopDeltas(previous, current)).toEqual([
      { namespace: 'app.orders', readMs: 10, writeMs: 0 },
      { namespace: 'app.users', readMs: 2, writeMs: 1 },
    ])
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
    expect(computeTopDeltas(previous, current)).toEqual([])
  })
})
