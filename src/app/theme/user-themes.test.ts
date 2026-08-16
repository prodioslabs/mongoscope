import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_THEMES } from '../theme'
import {
  buildThemeCatalog,
  refreshThemeCatalog,
  resetThemeCatalogForTests,
  resolveConfiguredThemeName,
} from '../theme/catalog'
import { loadUserThemes } from '../theme/user-themes'

const MINIMAL_THEME = {
  theme: {
    primary: '#aabbcc',
    secondary: '#112233',
    accent: '#445566',
    text: '#ffffff',
    textMuted: '#888888',
    background: '#000000',
  },
}

const tempRoots: string[] = []

afterEach(async () => {
  resetThemeCatalogForTests()
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

async function makeTempThemesDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mongoscope-themes-'))
  tempRoots.push(root)
  return root
}

describe('loadUserThemes', () => {
  it('returns empty themes when the directory is missing', async () => {
    const missing = join(tmpdir(), `mongoscope-missing-themes-${Date.now()}`)
    await expect(loadUserThemes(missing)).resolves.toEqual({ themes: {}, warnings: [] })
  })

  it('loads valid themes and skips invalid ones with warnings', async () => {
    const dir = await makeTempThemesDir()
    await writeFile(join(dir, 'custom.json'), JSON.stringify(MINIMAL_THEME), 'utf8')
    await writeFile(join(dir, 'broken.json'), '{not-json', 'utf8')
    await writeFile(
      join(dir, 'incomplete.json'),
      JSON.stringify({ theme: { primary: '#ffffff' } }),
      'utf8',
    )

    const result = await loadUserThemes(dir)
    expect(Object.keys(result.themes).sort()).toEqual(['custom'])
    expect(result.themes.custom).toEqual(MINIMAL_THEME)
    expect(result.warnings.length).toBe(2)
    expect(result.warnings.some((warning) => warning.includes('broken'))).toBe(true)
    expect(result.warnings.some((warning) => warning.includes('incomplete'))).toBe(true)
  })
})

describe('theme catalog precedence', () => {
  it('lets user themes override built-ins by name', async () => {
    const dir = await makeTempThemesDir()
    await writeFile(join(dir, 'gruvbox.json'), JSON.stringify(MINIMAL_THEME), 'utf8')

    const catalog = await refreshThemeCatalog(dir)
    expect(catalog.gruvbox).toEqual(MINIMAL_THEME)
    expect(catalog.nord).toEqual(DEFAULT_THEMES.nord)
  })

  it('buildThemeCatalog overlays user over builtins', () => {
    const merged = buildThemeCatalog(DEFAULT_THEMES, { gruvbox: MINIMAL_THEME as never })
    expect(merged.gruvbox).toEqual(MINIMAL_THEME)
    expect(merged.nord).toBe(DEFAULT_THEMES.nord)
  })

  it('falls back to gruvbox for unknown configured names without mutating catalog', () => {
    const catalog = buildThemeCatalog(DEFAULT_THEMES, {})
    expect(resolveConfiguredThemeName(catalog, 'does-not-exist')).toBe('gruvbox')
    expect(resolveConfiguredThemeName(catalog, 'nord')).toBe('nord')
  })
})
