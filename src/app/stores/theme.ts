import { create } from 'zustand'
import { saveAppConfig } from '../config/app-config'
import { DEFAULT_THEME_NAME, type ThemeMode } from '../config/types'
import { allThemes, hasTheme, resolveTheme } from '../theme'
import { getThemeCatalog, resolveConfiguredThemeName } from '../theme/catalog'

export type { ThemeMode }

type ThemeHydrateInput = {
  theme?: string
  mode?: ThemeMode
}

type ThemeState = {
  theme: ReturnType<typeof resolveTheme>
  selected: string
  all: typeof allThemes
  has: typeof hasTheme
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  set: (theme: string) => boolean
  /** Apply a bootstrapped selection without writing config. */
  hydrate: (partial: ThemeHydrateInput) => void
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

function schedulePersistThemeConfig(): void {
  if (!themePersistenceEnabled) {
    return
  }
  if (persistTimer !== undefined) {
    clearTimeout(persistTimer)
  }
  persistTimer = setTimeout(function persistThemeConfig() {
    persistTimer = undefined
    const { selected, mode } = useTheme.getState()
    void saveAppConfig({ theme: selected, mode }).catch(function warnThemePersistFailure(error) {
      const message = error instanceof Error ? error.message : String(error)
      // oxlint-disable-next-line no-console -- OpenTUI console overlay; persist failure
      console.warn(`Failed to persist theme config: ${message}`)
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
    schedulePersistThemeConfig()
  },
  set(name) {
    if (!hasTheme(name)) {
      return false
    }
    const { mode } = get()
    set({ selected: name, theme: resolveActiveTheme(name, mode) })
    schedulePersistThemeConfig()
    return true
  },
  hydrate(partial) {
    const current = get()
    const nextSelected =
      partial.theme != null
        ? resolveConfiguredThemeName(getThemeCatalog(), partial.theme)
        : current.selected
    const nextMode = partial.mode ?? current.mode
    set({
      selected: nextSelected,
      mode: nextMode,
      theme: resolveActiveTheme(nextSelected, nextMode),
    })
  },
}))
