import { describe, expect, it } from 'vitest'
import { buildEnableProfilingCommand } from './enable-profiling'
import { parseProfilingStatus } from './fetch-snapshot'
import { DEFAULT_SLOWMS } from './types'

describe('buildEnableProfilingCommand', () => {
  it('builds level-1 payload with given slowms', () => {
    expect(buildEnableProfilingCommand(200)).toEqual({ profile: 1, slowms: 200 })
  })

  it('falls back to default slowms for invalid values', () => {
    expect(buildEnableProfilingCommand(Number.NaN)).toEqual({
      profile: 1,
      slowms: DEFAULT_SLOWMS,
    })
  })
})

describe('parseProfilingStatus', () => {
  it('parses was/slowms from profile:-1', () => {
    expect(parseProfilingStatus({ was: 0, slowms: 100, ok: 1 })).toEqual({
      level: 0,
      slowms: 100,
    })
    expect(parseProfilingStatus({ was: 1, slowms: 50, ok: 1 })).toEqual({
      level: 1,
      slowms: 50,
    })
  })

  it('returns null for malformed payloads', () => {
    expect(parseProfilingStatus(null)).toBeNull()
    expect(parseProfilingStatus({ ok: 1 })).toBeNull()
  })
})
