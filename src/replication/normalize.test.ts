import { describe, expect, it } from 'vitest'
import {
  LAG_WARNING_SECONDS,
  memberStatusSeverity,
  normalizeReplicationTopology,
  type RawReplSetConfig,
  type RawReplSetStatus,
} from './normalize'

function statusFixture(overrides?: Partial<RawReplSetStatus>): RawReplSetStatus {
  return {
    set: 'rs0',
    members: [
      {
        _id: 0,
        name: 'mongo-a.example.net:27017',
        health: 1,
        state: 1,
        stateStr: 'PRIMARY',
        optimeDate: new Date('2024-08-15T23:06:13.978Z'),
        self: true,
      },
      {
        _id: 1,
        name: 'mongo-b.example.net:27017',
        health: 1,
        state: 2,
        stateStr: 'SECONDARY',
        optimeDate: new Date('2024-08-15T23:06:10.978Z'),
      },
      {
        _id: 2,
        name: 'mongo-c.example.net:27017',
        health: 1,
        state: 2,
        stateStr: 'SECONDARY',
        optimeDate: new Date('2024-08-15T23:05:50.978Z'),
      },
    ],
    ...overrides,
  }
}

function configFixture(overrides?: Partial<RawReplSetConfig>): RawReplSetConfig {
  return {
    config: {
      _id: 'rs0',
      members: [
        { _id: 0, host: 'mongo-a.example.net:27017', priority: 2, votes: 1 },
        { _id: 1, host: 'mongo-b.example.net:27017', priority: 1, votes: 1 },
        { _id: 2, host: 'mongo-c.example.net:27017', priority: 0, votes: 0 },
      ],
    },
    ...overrides,
  }
}

describe('LAG_WARNING_SECONDS', () => {
  it('defaults to 10 seconds', () => {
    expect(LAG_WARNING_SECONDS).toBe(10)
  })
})

describe('memberStatusSeverity', () => {
  it('marks healthy primary/secondary under the lag threshold as success', () => {
    expect(memberStatusSeverity({ health: 1, stateStr: 'PRIMARY', lagSeconds: 0 })).toBe('success')
    expect(memberStatusSeverity({ health: 1, stateStr: 'SECONDARY', lagSeconds: 9.9 })).toBe(
      'success',
    )
  })

  it('marks lagging but reachable secondaries as warning', () => {
    expect(memberStatusSeverity({ health: 1, stateStr: 'SECONDARY', lagSeconds: 10 })).toBe(
      'warning',
    )
    expect(memberStatusSeverity({ health: 1, stateStr: 'SECONDARY', lagSeconds: 42 })).toBe(
      'warning',
    )
  })

  it('marks recovering / startup2 as warning even with low lag', () => {
    expect(memberStatusSeverity({ health: 1, stateStr: 'RECOVERING', lagSeconds: 0 })).toBe(
      'warning',
    )
    expect(memberStatusSeverity({ health: 1, stateStr: 'STARTUP2', lagSeconds: 0 })).toBe('warning')
  })

  it('marks unreachable or fatal states as error', () => {
    expect(memberStatusSeverity({ health: 0, stateStr: 'SECONDARY', lagSeconds: 0 })).toBe('error')
    expect(memberStatusSeverity({ health: 1, stateStr: 'DOWN', lagSeconds: 0 })).toBe('error')
    expect(memberStatusSeverity({ health: 1, stateStr: 'UNKNOWN', lagSeconds: null })).toBe('error')
    expect(memberStatusSeverity({ health: 1, stateStr: 'ROLLBACK', lagSeconds: 1 })).toBe('error')
  })

  it('treats healthy arbiters as success with no lag', () => {
    expect(memberStatusSeverity({ health: 1, stateStr: 'ARBITER', lagSeconds: null })).toBe(
      'success',
    )
  })
})

describe('normalizeReplicationTopology', () => {
  it('joins status + config on _id and computes lag vs primary optimeDate', () => {
    const topology = normalizeReplicationTopology(statusFixture(), configFixture())

    expect(topology.setName).toBe('rs0')
    expect(topology.members).toEqual([
      {
        id: 0,
        name: 'mongo-a.example.net:27017',
        host: 'mongo-a.example.net:27017',
        stateStr: 'PRIMARY',
        health: 1,
        priority: 2,
        votes: 1,
        lagSeconds: 0,
        severity: 'success',
        self: true,
      },
      {
        id: 1,
        name: 'mongo-b.example.net:27017',
        host: 'mongo-b.example.net:27017',
        stateStr: 'SECONDARY',
        health: 1,
        priority: 1,
        votes: 1,
        lagSeconds: 3,
        severity: 'success',
        self: false,
      },
      {
        id: 2,
        name: 'mongo-c.example.net:27017',
        host: 'mongo-c.example.net:27017',
        stateStr: 'SECONDARY',
        health: 1,
        priority: 0,
        votes: 0,
        lagSeconds: 23,
        severity: 'warning',
        self: false,
      },
    ])
  })

  it('clamps negative lag to zero', () => {
    const status = statusFixture({
      members: [
        {
          _id: 0,
          name: 'a:27017',
          health: 1,
          state: 1,
          stateStr: 'PRIMARY',
          optimeDate: new Date('2024-01-01T00:00:00.000Z'),
        },
        {
          _id: 1,
          name: 'b:27017',
          health: 1,
          state: 2,
          stateStr: 'SECONDARY',
          // Appears ahead due to heartbeat timing.
          optimeDate: new Date('2024-01-01T00:00:05.000Z'),
        },
      ],
    })
    const topology = normalizeReplicationTopology(
      status,
      configFixture({
        config: {
          _id: 'rs0',
          members: [
            { _id: 0, host: 'a:27017', priority: 1, votes: 1 },
            { _id: 1, host: 'b:27017', priority: 1, votes: 1 },
          ],
        },
      }),
    )
    expect(topology.members[1]?.lagSeconds).toBe(0)
  })

  it('uses null lag when no primary optime is available', () => {
    const status = statusFixture({
      members: [
        {
          _id: 0,
          name: 'a:27017',
          health: 1,
          state: 2,
          stateStr: 'SECONDARY',
          optimeDate: new Date('2024-01-01T00:00:00.000Z'),
        },
      ],
    })
    const topology = normalizeReplicationTopology(
      status,
      configFixture({
        config: {
          _id: 'rs0',
          members: [{ _id: 0, host: 'a:27017', priority: 1, votes: 1 }],
        },
      }),
    )
    expect(topology.members[0]?.lagSeconds).toBeNull()
    expect(topology.members[0]?.severity).toBe('success')
  })

  it('defaults missing config fields and tolerates empty inputs', () => {
    expect(normalizeReplicationTopology(null, null)).toEqual({ setName: null, members: [] })
    const topology = normalizeReplicationTopology(
      {
        members: [
          {
            _id: 7,
            name: 'solo:27017',
            health: 0,
            state: 8,
            stateStr: 'DOWN',
          },
        ],
      },
      { config: { members: [] } },
    )
    expect(topology.members).toEqual([
      {
        id: 7,
        name: 'solo:27017',
        host: 'solo:27017',
        stateStr: 'DOWN',
        health: 0,
        priority: null,
        votes: null,
        lagSeconds: null,
        severity: 'error',
        self: false,
      },
    ])
  })
})
