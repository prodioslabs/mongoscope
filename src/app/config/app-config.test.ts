import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadAppConfig, saveAppConfigTheme, validateAppConfig } from './app-config'
import { DEFAULT_APP_CONFIG } from './types'

const tempRoots: string[] = []

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

async function makeTempConfigPath(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mongoscope-app-config-'))
  tempRoots.push(root)
  return join(root, 'config.json')
}

describe('validateAppConfig', () => {
  it('accepts version 1 with a theme name and ignores unknown keys', () => {
    expect(
      validateAppConfig({
        version: 1,
        theme: 'nord',
        futureKey: true,
      }),
    ).toEqual({ version: 1, theme: 'nord' })
  })

  it('rejects unsupported versions and empty theme', () => {
    expect(() => validateAppConfig({ version: 2, theme: 'nord' })).toThrow(/version/)
    expect(() => validateAppConfig({ version: 1, theme: '  ' })).toThrow(/theme/)
  })
})

describe('loadAppConfig / saveAppConfigTheme', () => {
  it('returns defaults when the file is missing', async () => {
    const path = await makeTempConfigPath()
    await unlink(path).catch(() => undefined)
    await expect(loadAppConfig(path)).resolves.toEqual(DEFAULT_APP_CONFIG)
  })

  it('throws when the file is corrupt or unsupported', async () => {
    const path = await makeTempConfigPath()
    await writeFile(path, '{not-json', 'utf8')
    await expect(loadAppConfig(path)).rejects.toThrow(/not valid JSON/)

    await writeFile(path, JSON.stringify({ version: 99, theme: 'nord' }), 'utf8')
    await expect(loadAppConfig(path)).rejects.toThrow(/version/)
  })

  it('round-trips a theme selection with atomic write', async () => {
    const path = await makeTempConfigPath()
    await saveAppConfigTheme('tokyonight', path)
    await expect(loadAppConfig(path)).resolves.toEqual({ version: 1, theme: 'tokyonight' })

    const written = JSON.parse(await readFile(path, 'utf8'))
    expect(written).toEqual({ version: 1, theme: 'tokyonight' })
  })
})
