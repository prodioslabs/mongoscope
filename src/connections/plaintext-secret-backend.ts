import { readFile } from 'node:fs/promises'
import { appConfigFilePath } from '../lib/config-paths'
import { isRecord } from '../lib/is-record'
import { updateJsonConfigFile } from '../lib/json-config-file'
import type { SecretBackend } from './secret-store'

/**
 * Persist secrets as plaintext strings under `secrets[service][name]` in config.json.
 * Does not touch theme / mode keys.
 */
export function createPlaintextSecretBackend(
  filePath: string = appConfigFilePath(),
): SecretBackend {
  return {
    async get({ service, name }) {
      const root = await readConfigObject(filePath)
      if (root == null) {
        return null
      }

      const secrets = root.secrets
      if (!isRecord(secrets)) {
        return null
      }

      const serviceBucket = secrets[service]
      if (!isRecord(serviceBucket)) {
        return null
      }

      const value = serviceBucket[name]
      return typeof value === 'string' ? value : null
    },

    async set({ service, name, value }) {
      await updateJsonConfigFile(filePath, (current) => {
        const secrets = isRecord(current.secrets) ? { ...current.secrets } : {}
        const serviceBucket = isRecord(secrets[service]) ? { ...secrets[service] } : {}
        serviceBucket[name] = value
        secrets[service] = serviceBucket
        return { ...current, secrets }
      })
    },

    async delete({ service, name }) {
      const existing = await readConfigObject(filePath)
      if (existing == null || !isRecord(existing.secrets)) {
        return false
      }
      const serviceBucket = existing.secrets[service]
      if (!isRecord(serviceBucket) || !(name in serviceBucket)) {
        return false
      }

      await updateJsonConfigFile(filePath, (current) => {
        if (!isRecord(current.secrets)) {
          return current
        }

        const secrets = { ...current.secrets }
        if (!isRecord(secrets[service])) {
          return current
        }

        const nextServiceBucket = { ...secrets[service] }
        delete nextServiceBucket[name]

        if (Object.keys(nextServiceBucket).length === 0) {
          delete secrets[service]
        } else {
          secrets[service] = nextServiceBucket
        }

        if (Object.keys(secrets).length === 0) {
          const next = { ...current }
          delete next.secrets
          return next
        }

        return { ...current, secrets }
      })
      return true
    },
  }
}

async function readConfigObject(filePath: string): Promise<Record<string, unknown> | null> {
  let fileContents: string
  try {
    fileContents = await readFile(filePath, 'utf8')
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return null
    }
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(fileContents)
  } catch {
    throw new Error(`Invalid config: ${filePath} is not valid JSON`)
  }

  return isRecord(parsed) ? parsed : null
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error != null &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
