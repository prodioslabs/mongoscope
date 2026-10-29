import { rename, unlink, writeFile } from 'node:fs/promises'

/**
 * Atomically write UTF-8 text (tmp file in the same directory + rename).
 * File mode is 0600 on create. Caller must ensure the parent directory exists.
 */
export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const temporaryFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`

  try {
    await writeFile(temporaryFilePath, content, { encoding: 'utf8', mode: 0o600 })
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
