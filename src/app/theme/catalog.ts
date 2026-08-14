import { userThemesDir } from '../../lib/config-paths'
import { DEFAULT_THEME_NAME } from '../config/types'
import { DEFAULT_THEMES, type ThemeJson } from './index'
import { loadUserThemes } from './user-themes'

let themeCatalog: Record<string, ThemeJson> | undefined
let themeLoadWarnings: string[] = []

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

export function getThemeLoadWarnings(): string[] {
  return themeLoadWarnings.slice()
}

/**
 * Scan user themes, merge over builtins (user wins), store warnings for UI/API.
 * Also `console.warn` each skip (OpenTUI captures console into the overlay; safe for the frame).
 * Unexpected I/O failures resolve to builtins-only (never reject).
 */
export async function refreshThemeCatalog(
  themesDirectory: string = userThemesDir(),
): Promise<Record<string, ThemeJson>> {
  try {
    const { themes, warnings } = await loadUserThemes(themesDirectory)
    themeLoadWarnings = warnings
    for (const warning of warnings) {
      // oxlint-disable-next-line no-console -- OpenTUI console overlay; skipped theme
      console.warn(warning)
    }
    themeCatalog = buildThemeCatalog(DEFAULT_THEMES, themes)
    return themeCatalog
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const warning = `Failed to refresh theme catalog: ${message}`
    themeLoadWarnings = [warning]
    // oxlint-disable-next-line no-console -- OpenTUI console overlay; catalog failure
    console.warn(warning)
    themeCatalog = buildThemeCatalog(DEFAULT_THEMES, {})
    return themeCatalog
  }
}

/** Test helper: reset module state between cases. */
export function resetThemeCatalogForTests(): void {
  themeCatalog = undefined
  themeLoadWarnings = []
}
