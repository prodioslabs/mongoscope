import { create } from 'zustand'
import { saveAppConfigTheme } from '../config/app-config'
import { DEFAULT_THEME_NAME } from '../config/types'
import { allThemes, hasTheme, resolveTheme } from '../theme'
import { getThemeCatalog, resolveConfiguredThemeName } from '../theme/catalog'

export type ThemeMode = 'dark' | 'light'

type ThemeState = {
  theme: ReturnType<typeof resolveTheme>
  selected: string
  all: typeof allThemes
  has: typeof hasTheme
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  set: (theme: string) => boolean
  /** Apply a bootstrapped selection without writing config. */
  hydrate: (themeName: string) => void
}

const THEME_PERSIST_DEBOUNCE_MS = 200

let themePersistenceEnabled = false
let persistTimer: ReturnType<typeof setTimeout> | undefined

/** Call after config + catalog are loaded and the store is hydrated. */
export function enableThemeConfigPersistence(): void {
  themePersistenceEnabled = true
}

function resolveActiveTheme(selected: string, mode: ThemeMode) {
  const themes = getThemeCatalog()
  // Catalog always includes DEFAULT_THEME_NAME (builtins merge base).
  const active = themes[selected] ?? themes[DEFAULT_THEME_NAME]!
  return resolveTheme(active, mode)
}

function schedulePersistThemeSelection(themeName: string): void {
  if (!themePersistenceEnabled) {
    return
  }
  if (persistTimer !== undefined) {
    clearTimeout(persistTimer)
  }
  persistTimer = setTimeout(function persistThemeSelection() {
    persistTimer = undefined
    void saveAppConfigTheme(themeName).catch(function warnThemePersistFailure(error) {
      const message = error instanceof Error ? error.message : String(error)
      // oxlint-disable-next-line no-console -- OpenTUI console overlay; persist failure
      console.warn(`Failed to persist theme selection: ${message}`)
    })
  }, THEME_PERSIST_DEBOUNCE_MS)
}

export const useTheme = create<ThemeState>((set, get) => ({
  mode: 'dark',
  selected: DEFAULT_THEME_NAME,
  theme: resolveActiveTheme(DEFAULT_THEME_NAME, 'dark'),
  all: allThemes,
  has: hasTheme,
  setMode(mode) {
    const { selected } = get()
    set({ mode, theme: resolveActiveTheme(selected, mode) })
  },
  set(name) {
    if (!hasTheme(name)) {
      return false
    }
    const { mode } = get()
    set({ selected: name, theme: resolveActiveTheme(name, mode) })
    schedulePersistThemeSelection(name)
    return true
  },
  hydrate(themeName) {
    const resolvedName = resolveConfiguredThemeName(getThemeCatalog(), themeName)
    const { mode } = get()
    set({ selected: resolvedName, theme: resolveActiveTheme(resolvedName, mode) })
  },
}))
