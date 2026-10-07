import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadAppConfig, saveAppConfig, validateAppConfig } from './app-config'
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
  it('accepts version 1 with theme + mode and ignores unknown keys', () => {
    expect(
      validateAppConfig({
        version: 1,
        theme: 'nord',
        mode: 'light',
        futureKey: true,
      }),
    ).toEqual({ version: 1, theme: 'nord', mode: 'light' })
  })

  it('defaults mode to dark when omitted (legacy config)', () => {
    expect(validateAppConfig({ version: 1, theme: 'nord' })).toEqual({
      version: 1,
      theme: 'nord',
      mode: 'dark',
    })
  })

  it('rejects unsupported versions, empty theme, and invalid mode', () => {
    expect(() => validateAppConfig({ version: 2, theme: 'nord' })).toThrow(/version/)
    expect(() => validateAppConfig({ version: 1, theme: '  ' })).toThrow(/theme/)
    expect(() => validateAppConfig({ version: 1, theme: 'nord', mode: 'dim' })).toThrow(/mode/)
  })

  it('accepts secrets-only objects as the default theme', () => {
    expect(
      validateAppConfig({
        secrets: { 'com.mongoscope.cli': { connections: '{}' } },
      }),
    ).toEqual(DEFAULT_APP_CONFIG)
  })
})

describe('loadAppConfig / saveAppConfig', () => {
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

  it('round-trips theme and mode with atomic write', async () => {
    const path = await makeTempConfigPath()
    await saveAppConfig({ theme: 'tokyonight', mode: 'light' }, path)
    await expect(loadAppConfig(path)).resolves.toEqual({
      version: 1,
      theme: 'tokyonight',
      mode: 'light',
    })

    const written = JSON.parse(await readFile(path, 'utf8'))
    expect(written).toEqual({ version: 1, theme: 'tokyonight', mode: 'light' })
  })

  it('loads legacy theme-only config as dark mode', async () => {
    const path = await makeTempConfigPath()
    await writeFile(path, JSON.stringify({ version: 1, theme: 'gruvbox' }), 'utf8')
    await expect(loadAppConfig(path)).resolves.toEqual({
      version: 1,
      theme: 'gruvbox',
      mode: 'dark',
    })
  })

  it('loads secrets-only config as the default theme', async () => {
    const path = await makeTempConfigPath()
    await writeFile(
      path,
      JSON.stringify({
        secrets: { 'com.mongoscope.cli': { connections: '{}' } },
      }),
      'utf8',
    )
    await expect(loadAppConfig(path)).resolves.toEqual(DEFAULT_APP_CONFIG)
  })

  it('preserves secrets when saving theme', async () => {
    const path = await makeTempConfigPath()
    await writeFile(
      path,
      JSON.stringify({
        secrets: { 'com.mongoscope.cli': { connections: 'blob' } },
      }),
      'utf8',
    )
    await saveAppConfig({ theme: 'nord', mode: 'light' }, path)
    const written = JSON.parse(await readFile(path, 'utf8'))
    expect(written).toEqual({
      secrets: { 'com.mongoscope.cli': { connections: 'blob' } },
      version: 1,
      theme: 'nord',
      mode: 'light',
    })
  })
})
