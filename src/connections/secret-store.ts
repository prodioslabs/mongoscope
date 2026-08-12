import { platform } from 'node:os'

export const SECRET_SERVICE = 'com.mongoscope.cli'

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
  getUri(id: string): Promise<string | null>
  setUri(id: string, uri: string): Promise<void>
  deleteUri(id: string): Promise<boolean>
}

export function secretNameForConnection(id: string): string {
  return `connection:${id}`
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
    async getUri(id) {
      try {
        return await backend.get({
          service: SECRET_SERVICE,
          name: secretNameForConnection(id),
        })
      } catch (error) {
        throw mapSecretError(error, 'retrieve')
      }
    },

    async setUri(id, uri) {
      try {
        await backend.set({
          service: SECRET_SERVICE,
          name: secretNameForConnection(id),
          value: uri,
        })
      } catch (error) {
        throw mapSecretError(error, 'store')
      }
    },

    async deleteUri(id) {
      try {
        return await backend.delete({
          service: SECRET_SERVICE,
          name: secretNameForConnection(id),
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
      return `Failed to ${actionVerb} connection credentials: OS secret service (libsecret) is unavailable. Start GNOME Keyring, KWallet, or another Secret Service daemon and try again.`
    }
    return `Failed to ${actionVerb} connection credentials: OS credential store is unavailable.`
  }

  if (code === 'denied') {
    if (platform() === 'darwin') {
      return `Failed to ${actionVerb} connection credentials: macOS Keychain access was denied. Allow access in Keychain Access and try again.`
    }
    return `Failed to ${actionVerb} connection credentials: access to the OS credential store was denied.`
  }

  return `Failed to ${actionVerb} connection credentials via the OS credential store.`
}

/** Safe for classification only — never included in SecretStoreError.message. */
function errorMessageText(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}
