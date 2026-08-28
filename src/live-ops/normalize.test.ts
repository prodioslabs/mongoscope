import { describe, expect, it } from 'vitest'
import { buildLockNote, normalizeCurrentOpDocs, parseServerStatus } from './normalize'

describe('normalizeCurrentOpDocs', () => {
  it('maps active ops and sorts by running time descending', () => {
    const { ops } = normalizeCurrentOpDocs([
      {
        active: true,
        opid: 2,
        ns: 'app.orders',
        op: 'update',
        microsecs_running: 50_000,
        waitingForLock: false,
        locks: { Collection: 'W' },
        client: '10.0.0.1:4000',
      },
      {
        active: true,
        opid: 1,
        ns: 'app.users',
        op: 'query',
        microsecs_running: 800_000,
        waitingForLock: false,
        client: '10.0.0.2:4001',
      },
    ])

    expect(ops).toHaveLength(2)
    expect(ops[0]?.opid).toBe('1')
    expect(ops[0]?.runningMs).toBe(800)
    expect(ops[1]?.opid).toBe('2')
    expect(ops[1]?.lock).toBe('Collection:W')
  })

  it('puts waiting lock info in WAITINGFOR and leaves LOCK empty', () => {
    const { ops } = normalizeCurrentOpDocs([
      {
        active: true,
        opid: 9,
        ns: 'app.orders',
        op: 'update',
        microsecs_running: 12_000,
        waitingForLock: true,
        locks: { Collection: 'W' },
        client_s: '127.0.0.1:1',
      },
    ])

    expect(ops[0]).toMatchObject({
      lock: '—',
      waitingFor: 'Collection:W',
      client: '127.0.0.1:1',
      waitingForLock: true,
    })
  })

  it('builds lock waits by namespace', () => {
    const { lockWaits } = normalizeCurrentOpDocs([
      {
        active: true,
        opid: 1,
        ns: 'a.x',
        op: 'update',
        waitingForLock: true,
        microsecs_running: 1000,
      },
      {
        active: true,
        opid: 2,
        ns: 'a.x',
        op: 'insert',
        waitingForLock: true,
        microsecs_running: 2000,
      },
      {
        active: true,
        opid: 3,
        ns: 'b.y',
        op: 'update',
        waitingForLock: true,
        microsecs_running: 3000,
      },
    ])

    expect(lockWaits).toEqual([
      { namespace: 'a.x', count: 2 },
      { namespace: 'b.y', count: 1 },
    ])
  })
})

describe('buildLockNote', () => {
  it('pairs longest waiter with longest holder on the same namespace', () => {
    const note = buildLockNote([
      {
        opid: '10',
        namespace: 'app.orders',
        op: 'update',
        runningMs: 100,
        lock: '—',
        waitingFor: 'Collection:W',
        client: '—',
        waitingForLock: true,
      },
      {
        opid: '20',
        namespace: 'app.orders',
        op: 'update',
        runningMs: 5000,
        lock: 'Collection:W',
        waitingFor: '—',
        client: '—',
        waitingForLock: false,
      },
    ])

    expect(note).toBe(
      'op 10 is blocked waiting on Collection:W lock held by op 20',
    )
  })

  it('falls back when waiters exist without a holder', () => {
    const note = buildLockNote([
      {
        opid: '1',
        namespace: 'app.orders',
        op: 'update',
        runningMs: 100,
        lock: '—',
        waitingFor: 'Collection:W',
        client: '—',
        waitingForLock: true,
      },
      {
        opid: '2',
        namespace: 'app.orders',
        op: 'insert',
        runningMs: 50,
        lock: '—',
        waitingFor: 'Collection:W',
        client: '—',
        waitingForLock: true,
      },
    ])

    expect(note).toBe('2 ops waiting for locks on app.orders')
  })

  it('returns empty string when nobody is waiting', () => {
    expect(
      buildLockNote([
        {
          opid: '1',
          namespace: 'app.orders',
          op: 'query',
          runningMs: 10,
          lock: '—',
          waitingFor: '—',
          client: '—',
          waitingForLock: false,
        },
      ]),
    ).toBe('')
  })
})

describe('parseServerStatus', () => {
  it('reads connections and queue fields', () => {
    const parsed = parseServerStatus({
      connections: { current: 12, available: 800, active: 4 },
      globalLock: { currentQueue: { readers: 1, writers: 2 } },
    })
    expect(parsed.connections).toEqual({ current: 12, available: 800, active: 4 })
    expect(parsed.queuedOps).toEqual({ readers: 1, writers: 2 })
  })
})
