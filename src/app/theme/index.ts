import { getThemeCatalog } from './catalog'
import { DEFAULT_THEMES, resolveTheme, selectedForeground, type Theme } from './default-themes'

export { DEFAULT_THEMES, resolveTheme, selectedForeground, type Theme }

export function allThemes() {
  return getThemeCatalog()
}

export function hasTheme(name: string) {
  if (!name) {
    return false
  }
  return allThemes()[name] !== undefined
}
