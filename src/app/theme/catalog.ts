import { userThemesDir } from '../../lib/config-paths'
import { DEFAULT_THEME_NAME } from '../config/types'
import { DEFAULT_THEMES, type ThemeJson } from './default-themes'
import { loadUserThemes } from './user-themes'

let themeCatalog: Record<string, ThemeJson> | undefined

export function buildThemeCatalog(
  builtins: Record<string, ThemeJson>,
  userThemes: Record<string, ThemeJson>,
): Record<string, ThemeJson> {
  return { ...builtins, ...userThemes }
}

/**
 * If `configuredName` exists in the catalog, return it; otherwise fall back to gruvbox.
 * Does not write config.
 */
export function resolveConfiguredThemeName(
  catalog: Record<string, ThemeJson>,
  configuredName: string,
  fallbackName: string = DEFAULT_THEME_NAME,
): string {
  const trimmed = configuredName.trim()
  if (trimmed !== '' && catalog[trimmed] !== undefined) {
    return trimmed
  }
  return fallbackName
}

export function getThemeCatalog(): Record<string, ThemeJson> {
  return themeCatalog ?? DEFAULT_THEMES
}

/**
 * Merge user themes over builtins (user wins). Logs skip warnings via
 * `console.warn` (OpenTUI console overlay).
 */
export async function refreshThemeCatalog(
  themesDirectory: string = userThemesDir(),
): Promise<Record<string, ThemeJson>> {
  const { themes, warnings } = await loadUserThemes(themesDirectory)
  for (const warning of warnings) {
    // oxlint-disable-next-line no-console -- OpenTUI console overlay; skipped theme
    console.warn(warning)
  }
  themeCatalog = buildThemeCatalog(DEFAULT_THEMES, themes)
  return themeCatalog
}

/** Test helper: reset module state between cases. */
export function resetThemeCatalogForTests(): void {
  themeCatalog = undefined
}
