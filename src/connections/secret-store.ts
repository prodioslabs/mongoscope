import { platform } from 'node:os'
import type { ConnectionsBlob } from './types'
import { emptyConnectionsBlob, validateConnectionsBlob } from './validate'
import { errorMessageText } from '../lib/error-message'

export const SECRET_SERVICE = 'com.mongoscope.cli'

/** Fixed secret name for the single connections JSON blob. */
export const CONNECTIONS_SECRET_NAME = 'connections'

export type SecretStoreCode = 'unavailable' | 'denied' | 'unknown'

export class SecretStoreError extends Error {
  readonly code: SecretStoreCode

  constructor(message: string, code: SecretStoreCode = 'unknown', options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'SecretStoreError'
    this.code = code
  }
}

/** Low-level backend — injectable for tests; never logs secret values. */
export type SecretBackend = {
  get(options: { service: string; name: string }): Promise<string | null>
  set(options: { service: string; name: string; value: string }): Promise<void>
  delete(options: { service: string; name: string }): Promise<boolean>
}

export type SecretStore = {
  /** Load the connections blob. Missing secret → empty store. */
  load(): Promise<ConnectionsBlob>
  save(blob: ConnectionsBlob): Promise<void>
  clear(): Promise<boolean>
}

/** Uses the Bun global so Vitest can import this module without resolving `bun` as a package. */
const bunSecretsBackend: SecretBackend = {
  get(options) {
    return Bun.secrets.get(options)
  },
  set(options) {
    return Bun.secrets.set(options)
  },
  delete(options) {
    return Bun.secrets.delete(options)
  },
}

export function createSecretStore(backend: SecretBackend = bunSecretsBackend): SecretStore {
  return {
    async load() {
      let raw: string | null
      try {
        raw = await backend.get({
          service: SECRET_SERVICE,
          name: CONNECTIONS_SECRET_NAME,
        })
      } catch (error) {
        throw mapSecretError(error, 'retrieve')
      }

      if (raw == null || raw.trim() === '') {
        return emptyConnectionsBlob()
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        throw new Error('Invalid connections store in OS keychain: not valid JSON')
      }

      return validateConnectionsBlob(parsed)
    },

    async save(blob) {
      const validated = validateConnectionsBlob(blob)
      const serialized = JSON.stringify(validated)
      try {
        await backend.set({
          service: SECRET_SERVICE,
          name: CONNECTIONS_SECRET_NAME,
          value: serialized,
        })
      } catch (error) {
        throw mapSecretError(error, 'store')
      }
    },

    async clear() {
      try {
        return await backend.delete({
          service: SECRET_SERVICE,
          name: CONNECTIONS_SECRET_NAME,
        })
      } catch (error) {
        throw mapSecretError(error, 'delete')
      }
    },
  }
}

export const defaultSecretStore = createSecretStore()

function mapSecretError(error: unknown, action: 'retrieve' | 'store' | 'delete'): SecretStoreError {
  const code = classifySecretError(error)
  return new SecretStoreError(userMessageForSecretError(code, action), code, { cause: error })
}

function classifySecretError(error: unknown): SecretStoreCode {
  const message = errorMessageText(error).toLowerCase()

  if (
    message.includes('libsecret') ||
    message.includes('secret service') ||
    message.includes('no such secret') ||
    message.includes('d-bus') ||
    message.includes('dbus') ||
    message.includes('not available') ||
    message.includes('unavailable')
  ) {
    return 'unavailable'
  }

  if (
    message.includes('denied') ||
    message.includes('not authorized') ||
    message.includes('authorization') ||
    message.includes('user canceled') ||
    message.includes('user cancelled') ||
    message.includes('errsec') ||
    message.includes('keychain')
  ) {
    return 'denied'
  }

  return 'unknown'
}

function userMessageForSecretError(
  code: SecretStoreCode,
  action: 'retrieve' | 'store' | 'delete',
): string {
  let actionVerb: string
  if (action === 'retrieve') {
    actionVerb = 'retrieve'
  } else if (action === 'store') {
    actionVerb = 'store'
  } else {
    actionVerb = 'delete'
  }

  if (code === 'unavailable') {
    if (platform() === 'linux') {
      return `Failed to ${actionVerb} connections: OS secret service (libsecret) is unavailable. Start GNOME Keyring, KWallet, or another Secret Service daemon and try again.`
    }
    return `Failed to ${actionVerb} connections: OS credential store is unavailable.`
  }

  if (code === 'denied') {
    if (platform() === 'darwin') {
      return `Failed to ${actionVerb} connections: macOS Keychain access was denied. Allow access in Keychain Access and try again.`
    }
    return `Failed to ${actionVerb} connections: access to the OS credential store was denied.`
  }

  return `Failed to ${actionVerb} connections via the OS credential store.`
}
