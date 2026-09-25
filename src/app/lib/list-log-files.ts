import type { Dirent } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

export const MONGODB_DEFAULT_LOG_DIR = '/var/log/mongodb'

function isMongoLogFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.log') || lower.startsWith('mongod.log') || lower.startsWith('mongos.log')
}

/**
 * Non-recursive listing of MongoDB-like log filenames, newest mtime first.
 * Missing directory (`ENOENT`) → `[]`. Other I/O errors propagate.
 */
export async function listLogFiles(dir: string): Promise<string[]> {
  let entries: Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return []
    }
    throw error
  }

  const files = entries.filter((entry) => entry.isFile() && isMongoLogFile(entry.name))

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

  return withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs).map((file) => file.name)
}

function isFileNotFoundError(error: unknown): boolean {
  return isNodeErrnoException(error) && error.code === 'ENOENT'
}

function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error != null && 'code' in error
}
