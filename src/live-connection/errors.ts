import { asDriverErrorLike } from '../lib/driver-error'
import { redactConnectionSecrets } from './redact'

export type LiveConnectionErrorCode =
  | 'invalid_uri'
  | 'auth'
  | 'unreachable'
  | 'dns'
  | 'tls'
  | 'missing_uri'
  | 'lost'
  | 'unknown'

/** Typed live-connect failure with a user-safe message (never contains raw URI). */
export class LiveConnectionError extends Error {
  readonly code: LiveConnectionErrorCode

  constructor(code: LiveConnectionErrorCode, message: string) {
    super(message)
    this.name = 'LiveConnectionError'
    this.code = code
  }
}

const AUTH_CODE = 18
const AUTH_NAME = 'AuthenticationFailed'

function errorText(error: unknown): string {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error
        ? error.cause.message
        : typeof error.cause === 'string'
          ? error.cause
          : ''
    return cause ? `${error.message} ${cause}` : error.message
  }
  return String(error)
}

function hasCode(error: unknown, code: string | number): boolean {
  const record = asDriverErrorLike(error)
  if (record == null) {
    return false
  }
  if (record.code === code || record.codeName === code) {
    return true
  }
  if (typeof record.code === 'string' && record.code.toUpperCase() === String(code).toUpperCase()) {
    return true
  }
  return false
}

function textMatches(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase()
  return needles.some((needle) => lower.includes(needle.toLowerCase()))
}

/**
 * Map a driver/system failure to a LiveConnectionError with a fixed, actionable message.
 * Raw driver text is never copied into `.message` (except unknown fallback after redaction).
 */
export function mapConnectFailure(error: unknown): LiveConnectionError {
  if (error instanceof LiveConnectionError) {
    return error
  }

  const raw = errorText(error)
  const redacted = redactConnectionSecrets(raw)

  if (
    textMatches(raw, ['Invalid MongoDB connection URI', 'uri must be a non-empty string']) ||
    hasCode(error, 'InvalidArgument') ||
    (error instanceof Error && error.name === 'MongoParseError')
  ) {
    if (textMatches(raw, ['missing host'])) {
      return new LiveConnectionError('invalid_uri', 'Invalid MongoDB connection URI: missing host')
    }
    return new LiveConnectionError('invalid_uri', 'Invalid MongoDB connection URI')
  }

  if (
    hasCode(error, AUTH_CODE) ||
    hasCode(error, AUTH_NAME) ||
    textMatches(raw, ['Authentication failed', 'auth failed', 'not authorized', 'SCRAM'])
  ) {
    return new LiveConnectionError('auth', 'Authentication failed. Check username and password.')
  }

  if (
    textMatches(raw, [
      'SSL',
      'TLS',
      'CERT',
      'UNABLE_TO_VERIFY',
      'certificate',
      'self signed',
      'unable to get local issuer',
    ])
  ) {
    return new LiveConnectionError(
      'tls',
      'TLS/SSL connection failed. Check certificates and Atlas TLS settings.',
    )
  }

  if (
    textMatches(raw, ['querySrv', 'ENOTFOUND', 'getaddrinfo', 'EAI_AGAIN']) ||
    (textMatches(raw, ['ECONNREFUSED']) && textMatches(raw, ['querySrv', '_mongodb._tcp']))
  ) {
    return new LiveConnectionError(
      'dns',
      'Could not resolve MongoDB host (DNS/SRV). Check the URI and network.',
    )
  }

  if (
    (error instanceof Error && error.name === 'MongoServerSelectionError') ||
    textMatches(raw, [
      'Server selection timed out',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'connection timed out',
    ])
  ) {
    return new LiveConnectionError(
      'unreachable',
      'Could not reach MongoDB within 8s. Check host, port, and network.',
    )
  }

  const detail = redacted.trim()
  if (detail.length > 0 && detail.length <= 120 && !detail.includes('@')) {
    return new LiveConnectionError('unknown', `Connection failed. ${detail}`)
  }
  return new LiveConnectionError('unknown', 'Connection failed.')
}
