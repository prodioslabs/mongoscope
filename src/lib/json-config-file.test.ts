import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { saveJsonConfigFile, updateJsonConfigFile } from './json-config-file'

const tempRoots: string[] = []

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

async function makeTempPath(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mongoscope-json-config-'))
  tempRoots.push(root)
  return join(root, name)
}

describe('updateJsonConfigFile', () => {
  it('creates a file from an empty baseline when missing', async () => {
    const path = await makeTempPath('config.json')
    await updateJsonConfigFile(path, (current) => ({ ...current, theme: 'nord' }))
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ theme: 'nord' })
  })

  it('merges a patch onto existing keys', async () => {
    const path = await makeTempPath('config.json')
    await saveJsonConfigFile(path, { version: 1, theme: 'gruvbox', secrets: { a: { b: 'c' } } })
    await updateJsonConfigFile(path, (current) => ({
      ...current,
      theme: 'nord',
      mode: 'light',
    }))
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      version: 1,
      theme: 'nord',
      mode: 'light',
      secrets: { a: { b: 'c' } },
    })
  })
})
