export const DEFAULT_LOCAL_MONGODB_URI = 'mongodb://localhost:27017'

export const DEFAULT_MONGODB_PORT = 27017

export type MongoDbUriParts = {
  host: string
  port?: number
  username?: string
  password?: string
  authDb?: string
}

export type CliMongoUriOptions = {
  uri?: string
  host?: string
  port?: number
  username?: string
  password?: string
  authDb?: string
}

/**
 * Derive a display host label from a MongoDB URI without retaining credentials.
 */
export function hostLabelFromUri(uri: string): string {
  const trimmedUri = uri.trim()
  if (trimmedUri === '') {
    throw new Error('uri must be a non-empty string')
  }

  let parsedUrl: URL
  try {
    const urlCompatibleUri = trimmedUri
      .replace(/^mongodb\+srv:/i, 'https:')
      .replace(/^mongodb:/i, 'http:')
    parsedUrl = new URL(urlCompatibleUri)
  } catch {
    throw new Error('Invalid MongoDB connection URI')
  }

  if (!parsedUrl.hostname) {
    throw new Error('Invalid MongoDB connection URI: missing host')
  }

  if (parsedUrl.port) {
    return `${parsedUrl.hostname}:${parsedUrl.port}`
  }

  return parsedUrl.hostname
}

/**
 * Build a `mongodb://` URI from discrete connection parts (CLI `--host` style flags).
 */
export function buildMongoDbUri(parts: MongoDbUriParts): string {
  const host = parts.host.trim()
  if (host === '') {
    throw new Error('host must be a non-empty string')
  }

  const port = parts.port ?? DEFAULT_MONGODB_PORT
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('port must be an integer between 1 and 65535')
  }

  const username = parts.username?.trim() ?? ''
  const password = parts.password ?? ''
  const authDb = parts.authDb?.trim() ?? ''

  if (password !== '' && username === '') {
    throw new Error('username is required when password is set')
  }

  let auth = ''
  if (username !== '') {
    auth = `${encodeURIComponent(username)}`
    if (password !== '') {
      auth += `:${encodeURIComponent(password)}`
    }
    auth += '@'
  }

  const query = authDb !== '' ? `?authSource=${encodeURIComponent(authDb)}` : ''
  return `mongodb://${auth}${host}:${port}/${query}`
}

/**
 * Resolve a MongoDB URI from CLI options. Returns null when no live flags are set.
 * Throws on invalid combinations or values.
 */
export function resolveCliMongoUri(options: CliMongoUriOptions): string | null {
  const uri = options.uri?.trim() ?? ''
  const host = options.host?.trim() ?? ''
  const hasDiscrete =
    host !== '' ||
    options.port != null ||
    (options.username?.trim() ?? '') !== '' ||
    (options.password ?? '') !== '' ||
    (options.authDb?.trim() ?? '') !== ''

  if (uri !== '' && hasDiscrete) {
    throw new Error('Use either --uri or --host/--port/--username/--password/--auth-db, not both')
  }

  if (uri !== '') {
    hostLabelFromUri(uri)
    return uri
  }

  if (!hasDiscrete) {
    return null
  }

  if (host === '') {
    throw new Error('--host is required when using --port/--username/--password/--auth-db')
  }

  return buildMongoDbUri({
    host,
    port: options.port,
    username: options.username,
    password: options.password,
    authDb: options.authDb,
  })
}
