import { getThemeCatalog } from './catalog'
import {
  DEFAULT_THEMES,
  isTheme,
  resolveTheme,
  selectedForeground,
  type Theme,
  type ThemeJson,
} from './default-themes'

export {
  DEFAULT_THEMES,
  isTheme,
  resolveTheme,
  selectedForeground,
  type Theme,
  type ThemeJson,
}

export function allThemes() {
  return getThemeCatalog()
}

export function hasTheme(name: string) {
  if (!name) {
    return false
  }
  return allThemes()[name] !== undefined
}
