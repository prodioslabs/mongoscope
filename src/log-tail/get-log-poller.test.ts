import { describe, expect, it } from 'vitest'
import { createGetLogPoller } from './get-log-poller'

describe('createGetLogPoller', () => {
  it('seeds the ring from the first getLog window', async () => {
    const poller = createGetLogPoller({
      pollIntervalMs: 60_000,
      async fetchLog() {
        return {
          log: [
            JSON.stringify({
              t: { $date: '2024-01-01T00:00:00.000Z' },
              s: 'I',
              c: 'COMMAND',
              id: 1,
              ctx: 'conn1',
              msg: 'hello',
            }),
            JSON.stringify({
              t: { $date: '2024-01-01T00:00:01.000Z' },
              s: 'I',
              c: 'NETWORK',
              id: 2,
              ctx: 'conn1',
              msg: 'world',
            }),
          ],
        }
      },
    })

    await poller.start()
    const snap = poller.getSnapshot()
    expect(snap.lines).toHaveLength(2)
    expect(snap.lines[0]!.msg).toBe('hello')
    expect(snap.lines[1]!.msg).toBe('world')
    expect(snap.stats.format).toBe('JSON (4.4+)')
    poller.stop()
  })

  it('appends only new-since-last-poll lines', async () => {
    let call = 0
    const windows = [
      {
        log: [
          lineJson('COMMAND', 'a'),
          lineJson('COMMAND', 'b'),
          lineJson('COMMAND', 'c'),
        ],
      },
      {
        log: [
          lineJson('COMMAND', 'b'),
          lineJson('COMMAND', 'c'),
          lineJson('COMMAND', 'd'),
        ],
      },
    ]

    const poller = createGetLogPoller({
      pollIntervalMs: 60_000,
      async fetchLog() {
        const value = windows[call]!
        call++
        return value
      },
    })

    await poller.start()
    expect(poller.getSnapshot().lines.map((l) => l.msg)).toEqual(['a', 'b', 'c'])

    await poller.pollOnce()
    expect(poller.getSnapshot().lines.map((l) => l.msg)).toEqual(['a', 'b', 'c', 'd'])
    expect(poller.getSnapshot().stats.restartsDetected).toBe(0)
    poller.stop()
  })

  it('increments wrap counter when the RAM window fully rotates', async () => {
    let call = 0
    const poller = createGetLogPoller({
      pollIntervalMs: 60_000,
      async fetchLog() {
        call++
        if (call === 1) {
          return { log: [lineJson('COMMAND', 'old')] }
        }
        return { log: [lineJson('COMMAND', 'brand-new')] }
      },
    })

    await poller.start()
    await poller.pollOnce()
    expect(poller.getSnapshot().stats.restartsDetected).toBe(1)
    expect(poller.getSnapshot().lines.map((l) => l.msg)).toEqual(['old', 'brand-new'])
    poller.stop()
  })

  it('maps unauthorized errors to a clear message', async () => {
    const poller = createGetLogPoller({
      pollIntervalMs: 60_000,
      async fetchLog() {
        throw { code: 13, codeName: 'Unauthorized', message: 'not authorized' }
      },
    })

    await poller.start()
    expect(poller.getSnapshot().error).toContain('getLog / clusterMonitor')
    poller.stop()
  })
})

function lineJson(component: string, msg: string): string {
  return JSON.stringify({
    t: { $date: '2024-01-01T00:00:00.000Z' },
    s: 'I',
    c: component,
    id: 1,
    ctx: 'conn1',
    msg,
  })
}
