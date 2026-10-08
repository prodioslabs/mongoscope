import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { atomicWriteFile } from './atomic-write-file'

const tempRoots: string[] = []

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

describe('atomicWriteFile', () => {
  it('writes content with mode 0600', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mongoscope-atomic-'))
    tempRoots.push(root)
    const path = join(root, 'out.txt')
    await atomicWriteFile(path, 'hello\n')
    expect(await readFile(path, 'utf8')).toBe('hello\n')
    const mode = (await stat(path)).mode & 0o777
    expect(mode).toBe(0o600)
  })
})
