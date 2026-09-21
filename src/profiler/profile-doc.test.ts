import { describe, expect, it } from 'vitest'
import { profileDocToAttr, profileDocTimestampMs, toProfileSample } from './profile-doc'

describe('profileDocToAttr', () => {
  it('maps millis to durationMillis and keeps ns/command/planSummary', () => {
    const attr = profileDocToAttr({
      ns: 'app.orders',
      op: 'query',
      millis: 250,
      planSummary: 'COLLSCAN',
      docsExamined: 100,
      nreturned: 5,
      command: { find: 'orders', filter: { status: 'open' } },
    })
    expect(attr).toEqual({
      ns: 'app.orders',
      command: { find: 'orders', filter: { status: 'open' } },
      type: 'query',
      durationMillis: 250,
      planSummary: 'COLLSCAN',
      docsExamined: 100,
      nreturned: 5,
    })
  })

  it('returns null when ns is missing', () => {
    expect(profileDocToAttr({ millis: 10, op: 'query' })).toBeNull()
  })

  it('skips system.$cmd namespaces', () => {
    expect(
      profileDocToAttr({
        ns: 'app.$cmd',
        millis: 10,
        op: 'command',
      }),
    ).toBeNull()
  })

  it('maps client to remote and numYield to numYields', () => {
    const attr = profileDocToAttr({
      ns: 'app.users',
      millis: 12,
      client: '127.0.0.1:51234',
      numYield: 3,
      appName: 'mongosh',
      protocol: 'op_msg',
    })
    expect(attr).toMatchObject({
      remote: '127.0.0.1:51234',
      numYields: 3,
      appName: 'mongosh',
      protocol: 'op_msg',
    })
  })
})

describe('profileDocTimestampMs', () => {
  it('reads Date ts', () => {
    const ts = new Date('2024-01-15T12:00:00.000Z')
    expect(profileDocTimestampMs({ ts })).toBe(ts.getTime())
  })

  it('returns NaN when ts missing', () => {
    expect(Number.isNaN(profileDocTimestampMs({ ns: 'a.b' }))).toBe(true)
  })
})

describe('toProfileSample', () => {
  it('returns null for command noise', () => {
    expect(toProfileSample({ ns: 'test.$cmd', millis: 1 })).toBeNull()
  })

  it('returns sample with attr and timestamp', () => {
    const ts = new Date('2024-06-01T00:00:00.000Z')
    const doc = {
      ns: 'db.coll',
      millis: 40,
      op: 'query',
      ts,
      command: { find: 'coll', filter: { a: 1 } },
    }
    const sample = toProfileSample(doc)
    expect(sample).not.toBeNull()
    expect(sample!.timestampMs).toBe(ts.getTime())
    expect(sample!.attr).toMatchObject({ ns: 'db.coll', durationMillis: 40 })
  })
})
