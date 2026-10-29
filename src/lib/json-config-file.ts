import { mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { atomicWriteFile } from './atomic-write-file'
import { isRecord } from './is-record'
import { isFileNotFoundError } from './node-errno'

/**
 * Load a JSON config file. Missing file → `fallback`.
 * Invalid JSON / validation failure → throws (caller decides fallback).
 */
export async function loadJsonConfigFile<T>(
  filePath: string,
  fallback: T,
  validate: (value: unknown) => T,
): Promise<T> {
  let fileContents: string
  try {
    fileContents = await readFile(filePath, 'utf8')
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return fallback
    }
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(fileContents)
  } catch {
    throw new Error(`Invalid config: ${filePath} is not valid JSON`)
  }

  return validate(parsed)
}

/**
 * Read the existing JSON object (missing file → `{}`), apply `patch`, write atomically.
 * `patch` receives a shallow clone of the current record and must return the next object to persist.
 */
export async function updateJsonConfigFile(
  filePath: string,
  patch: (current: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const current = await readJsonObjectOrEmpty(filePath)
  const next = patch({ ...current })
  await saveJsonConfigFile(filePath, next)
}

export async function saveJsonConfigFile<T>(filePath: string, value: T): Promise<void> {
  const directoryPath = dirname(filePath)
  await mkdir(directoryPath, { recursive: true })
  const serialized = `${JSON.stringify(value, null, 2)}\n`
  await atomicWriteFile(filePath, serialized)
}

async function readJsonObjectOrEmpty(filePath: string): Promise<Record<string, unknown>> {
  let fileContents: string
  try {
    fileContents = await readFile(filePath, 'utf8')
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return {}
    }
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(fileContents)
  } catch {
    throw new Error(`Invalid config: ${filePath} is not valid JSON`)
  }

  if (!isRecord(parsed)) {
    throw new Error(`Invalid config: ${filePath} must be a JSON object`)
  }

  return parsed
}
