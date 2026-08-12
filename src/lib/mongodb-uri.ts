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
