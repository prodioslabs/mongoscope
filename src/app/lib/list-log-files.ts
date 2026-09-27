import type { Dirent } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

export const MONGODB_DEFAULT_LOG_DIR = '/var/log/mongodb'

export type ListLogFilesResult =
  | { status: 'ok'; files: string[] }
  | { status: 'empty' }
  | { status: 'not_found' }
  | { status: 'permission_denied' }
  | { status: 'other'; message: string }

export function isMongoLogFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.log') || lower.startsWith('mongod.log') || lower.startsWith('mongos.log')
}

/**
 * Non-recursive listing of MongoDB-like log filenames, newest mtime first.
 * Returns a discriminated result so callers can show distinct messages for
 * missing dirs, permission errors, empty dirs, and other I/O failures.
 */
export async function listLogFiles(dir: string): Promise<ListLogFilesResult> {
  let entries: Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    return listErrorFromUnknown(error)
  }

  const files = entries.filter((entry) => entry.isFile() && isMongoLogFile(entry.name))

  if (files.length === 0) {
    return { status: 'empty' }
  }

  const withMtime = await Promise.all(
    files.map(async (entry) => {
      try {
        const { mtimeMs } = await stat(join(dir, entry.name))
        return { name: entry.name, mtimeMs }
      } catch {
        // File may vanish between readdir and stat (TOCTOU); keep name, sort last.
        return { name: entry.name, mtimeMs: 0 }
      }
    }),
  )

  return {
    status: 'ok',
    files: withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs).map((file) => file.name),
  }
}

export function filesFromListResult(result: ListLogFilesResult): string[] {
  if (result.status === 'ok') {
    return result.files
  }
  return []
}

/** Map a readdir failure to a non-success list result (`EPERM` ≡ `EACCES`). */
export function listErrorFromUnknown(
  error: unknown,
): Exclude<ListLogFilesResult, { status: 'ok' } | { status: 'empty' }> {
  if (isFileNotFoundError(error)) {
    return { status: 'not_found' }
  }
  if (isPermissionDeniedError(error)) {
    return { status: 'permission_denied' }
  }
  return {
    status: 'other',
    message: error instanceof Error ? error.message : String(error),
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return isNodeErrnoException(error) && error.code === 'ENOENT'
}

function isPermissionDeniedError(error: unknown): boolean {
  if (!isNodeErrnoException(error)) {
    return false
  }
  return error.code === 'EACCES' || error.code === 'EPERM'
}

function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error != null && 'code' in error
}
