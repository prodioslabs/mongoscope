import { describe, expect, it } from 'vitest'
import { LiveConnectionError, mapConnectFailure } from './errors'
import { formatLiveConnectionError } from './format-live-connection-error'

describe('formatLiveConnectionError', () => {
  it('returns LiveConnectionError messages as-is', () => {
    const error = new LiveConnectionError('auth', 'Authentication failed. Check username and password.')
    expect(formatLiveConnectionError(error)).toBe(error.message)
  })

  it('redacts secrets from generic Error messages', () => {
    const error = new Error('boom mongodb://user:pass@host:27017')
    expect(formatLiveConnectionError(error)).not.toContain('pass')
    expect(formatLiveConnectionError(error)).toContain('[redacted-uri]')
  })

  it('never returns empty for nullish input', () => {
    expect(formatLiveConnectionError(null)).toBe('Connection failed.')
    expect(formatLiveConnectionError(undefined)).toBe('Connection failed.')
  })
})

describe('mapConnectFailure', () => {
  it('maps auth failures', () => {
    const error = Object.assign(new Error('Authentication failed'), {
      code: 18,
      codeName: 'AuthenticationFailed',
    })
    const mapped = mapConnectFailure(error)
    expect(mapped.code).toBe('auth')
    expect(mapped.message).toBe('Authentication failed. Check username and password.')
  })

  it('maps server selection timeouts to unreachable', () => {
    const error = Object.assign(new Error('Server selection timed out after 8000 ms'), {
      name: 'MongoServerSelectionError',
    })
    expect(mapConnectFailure(error).code).toBe('unreachable')
  })

  it('maps DNS SRV failures', () => {
    const error = new Error('querySrv ECONNREFUSED _mongodb._tcp.cluster.mongodb.net')
    expect(mapConnectFailure(error).code).toBe('dns')
  })

  it('maps TLS failures', () => {
    const error = new Error('SSL alert: UNABLE_TO_VERIFY_LEAF_SIGNATURE')
    expect(mapConnectFailure(error).code).toBe('tls')
  })

  it('maps invalid URI parse errors', () => {
    const error = Object.assign(new Error('Invalid connection string'), {
      name: 'MongoParseError',
    })
    expect(mapConnectFailure(error).code).toBe('invalid_uri')
  })
})
