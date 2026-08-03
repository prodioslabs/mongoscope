import { create } from 'zustand'
import { allThemes, hasTheme, resolveTheme } from '../theme'

export type ThemeMode = 'dark' | 'light'

type ThemeState = {
  theme: ReturnType<typeof resolveTheme>
  selected: string
  all: typeof allThemes
  has: typeof hasTheme
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  set: (theme: string) => boolean
}

function resolveActiveTheme(selected: string, mode: ThemeMode) {
  const themes = allThemes()
  const active = themes[selected]
  if (active) return resolveTheme(active, mode)
  return resolveTheme(themes.gruvbox!, mode)
}

export const useTheme = create<ThemeState>((set, get) => ({
  mode: 'dark',
  selected: 'gruvbox',
  theme: resolveActiveTheme('gruvbox', 'dark'),
  all: allThemes,
  has: hasTheme,
  setMode(mode) {
    const { selected } = get()
    set({ mode, theme: resolveActiveTheme(selected, mode) })
  },
  set(name) {
    if (!hasTheme(name)) return false
    const { mode } = get()
    set({ selected: name, theme: resolveActiveTheme(name, mode) })
    return true
  },
}))
