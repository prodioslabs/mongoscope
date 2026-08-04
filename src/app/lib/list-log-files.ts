import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

export const MONGODB_DEFAULT_LOG_DIR = '/var/log/mongodb'

function isMongoLogFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('.log') || lower.startsWith('mongod.log') || lower.startsWith('mongos.log')
}

/** Non-recursive listing of MongoDB-like log filenames. Returns [] if unreadable. */
export async function listLogFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const files = entries.filter((entry) => entry.isFile() && isMongoLogFile(entry.name))

    const withMtime = await Promise.all(
      files.map(async (entry) => {
        try {
          const { mtimeMs } = await stat(join(dir, entry.name))
          return { name: entry.name, mtimeMs }
        } catch {
          return { name: entry.name, mtimeMs: 0 }
        }
      }),
    )

    return withMtime.sort((a, b) => b.mtimeMs - a.mtimeMs).map((file) => file.name)
  } catch {
    return []
  }
}
