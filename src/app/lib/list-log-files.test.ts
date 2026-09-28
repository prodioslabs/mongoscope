import { chmod, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { filesFromListResult, listErrorFromUnknown, listLogFiles } from './list-log-files'

const tempRoots: string[] = []

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await chmod(root, 0o755).catch(() => undefined)
    await rm(root, { recursive: true, force: true })
  }
})

async function makeTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mongoscope-log-list-'))
  tempRoots.push(root)
  return root
}

function errnoError(code: string, message: string): NodeJS.ErrnoException {
  return Object.assign(new Error(message), { code })
}

describe('listErrorFromUnknown', () => {
  it('maps ENOENT to not_found', () => {
    expect(listErrorFromUnknown(errnoError('ENOENT', 'missing'))).toEqual({ status: 'not_found' })
  })

  it('maps EACCES and EPERM to permission_denied', () => {
    expect(listErrorFromUnknown(errnoError('EACCES', 'denied'))).toEqual({
      status: 'permission_denied',
    })
    expect(listErrorFromUnknown(errnoError('EPERM', 'denied'))).toEqual({
      status: 'permission_denied',
    })
  })

  it('maps other errors to other with message', () => {
    expect(listErrorFromUnknown(errnoError('ENOTDIR', 'not a directory'))).toEqual({
      status: 'other',
      message: 'not a directory',
    })
  })
})

describe('listLogFiles', () => {
  it('returns ok with mongo-like files newest-first', async () => {
    const dir = await makeTempDir()
    const older = join(dir, 'mongod.log.1')
    const newer = join(dir, 'mongod.log')
    await writeFile(older, 'old\n', 'utf8')
    await writeFile(newer, 'new\n', 'utf8')
    // Ensure distinct mtimes (filesystem resolution can be coarse).
    const past = new Date(Date.now() - 60_000)
    await utimes(older, past, past)

    const result = await listLogFiles(dir)
    expect(result).toEqual({ status: 'ok', files: ['mongod.log', 'mongod.log.1'] })
    expect(filesFromListResult(result)).toEqual(['mongod.log', 'mongod.log.1'])
  })

  it('returns empty when the directory exists but has no mongo log files', async () => {
    const dir = await makeTempDir()
    await writeFile(join(dir, 'readme.txt'), 'hi\n', 'utf8')

    await expect(listLogFiles(dir)).resolves.toEqual({ status: 'empty' })
  })

  it('returns not_found when the directory does not exist', async () => {
    const missing = join(tmpdir(), `mongoscope-missing-logs-${Date.now()}-${Math.random()}`)
    await expect(listLogFiles(missing)).resolves.toEqual({ status: 'not_found' })
  })

  it('returns permission_denied when the directory is unreadable', async () => {
    const dir = await makeTempDir()
    await writeFile(join(dir, 'mongod.log'), 'x\n', 'utf8')
    await chmod(dir, 0o000)

    const result = await listLogFiles(dir)
    await chmod(dir, 0o755)

    // True root may still list; otherwise expect permission_denied.
    if (result.status === 'ok') {
      expect(result.files).toContain('mongod.log')
      return
    }
    expect(result).toEqual({ status: 'permission_denied' })
  })

  it('maps a non-directory path to other (ENOTDIR) with a message', async () => {
    const dir = await makeTempDir()
    const filePath = join(dir, 'not-a-dir.log')
    await writeFile(filePath, 'x\n', 'utf8')

    const result = await listLogFiles(filePath)
    expect(result.status).toBe('other')
    if (result.status === 'other') {
      expect(result.message.length).toBeGreaterThan(0)
    }
  })
})

describe('filesFromListResult', () => {
  it('returns files only for ok', () => {
    expect(filesFromListResult({ status: 'ok', files: ['a.log'] })).toEqual(['a.log'])
    expect(filesFromListResult({ status: 'empty' })).toEqual([])
    expect(filesFromListResult({ status: 'not_found' })).toEqual([])
    expect(filesFromListResult({ status: 'permission_denied' })).toEqual([])
    expect(filesFromListResult({ status: 'other', message: 'boom' })).toEqual([])
  })
})
