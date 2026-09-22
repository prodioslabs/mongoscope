import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

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
 * Atomically write JSON (tmp file in the same directory + rename).
 */
export async function saveJsonConfigFile(filePath: string, value: unknown): Promise<void> {
  const directoryPath = dirname(filePath)
  await mkdir(directoryPath, { recursive: true })

  const temporaryFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  const serialized = `${JSON.stringify(value, null, 2)}\n`

  try {
    await writeFile(temporaryFilePath, serialized, { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryFilePath, filePath)
  } catch (error) {
    try {
      await unlink(temporaryFilePath)
    } catch {
      // ignore cleanup failure
    }
    throw error
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return isNodeErrnoException(error) && error.code === 'ENOENT'
}

function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error != null && 'code' in error
}
