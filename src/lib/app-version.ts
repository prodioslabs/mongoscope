import { createRequire } from 'node:module'

/**
 * Compiled binaries embed the version via Bun `define`.
 * Dev / bun-link falls back to package.json so the string cannot drift.
 */
export function resolveAppVersion(): string {
  const embedded = process.env.MONGOSCOPE_EMBEDDED_VERSION
  if (typeof embedded === 'string' && embedded.trim() !== '') {
    return embedded.trim()
  }
  const { version } = createRequire(import.meta.url)('../../package.json') as {
    version: string
  }
  return version
}
