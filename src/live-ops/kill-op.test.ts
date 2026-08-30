import { describe, expect, it } from 'vitest'
import { mapKillOpError, parseKillOpid } from './kill-op'

describe('parseKillOpid', () => {
  it('parses numeric opids', () => {
    expect(parseKillOpid('12345')).toBe(12345)
    expect(parseKillOpid('0')).toBe(0)
  })

  it('rejects missing or invalid opids', () => {
    expect(parseKillOpid('—')).toBeNull()
    expect(parseKillOpid('')).toBeNull()
    expect(parseKillOpid('abc')).toBeNull()
  })
})

describe('killCurrentOp', () => {
  it('returns not connected when client is null', async () => {
    const { killCurrentOp } = await import('./kill-op')
    const result = await killCurrentOp(null, 123)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('not_connected')
      expect(result.message).toBe('not connected')
    }
  })
})

describe('mapKillOpError', () => {
  it('maps unauthorized errors', () => {
    const result = mapKillOpError(Object.assign(new Error('not authorized'), { code: 13 }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('permission')
      expect(result.message).toContain('killop')
    }
  })

  it('maps operation not found', () => {
    const result = mapKillOpError(new Error('no such operation'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('not_found')
      expect(result.message).toBe('operation already finished')
    }
  })

  it('maps sharded write failures', () => {
    const result = mapKillOpError(
      new Error('cannot kill write operation on mongos without session'),
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('sharded_write')
    }
  })

  it('maps unknown errors', () => {
    const result = mapKillOpError(new Error('something unexpected'))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('unknown')
      expect(result.message).toBe('could not kill operation')
    }
  })
})
