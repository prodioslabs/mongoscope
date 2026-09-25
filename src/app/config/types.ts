export const DEFAULT_THEME_NAME = 'gruvbox'

export type ThemeMode = 'dark' | 'light'

export type AppConfig = {
  version: 1
  /** Selected theme name (not a palette). */
  theme: string
  /** Light/dark palette within the selected theme. */
  mode: ThemeMode
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  version: 1,
  theme: DEFAULT_THEME_NAME,
  mode: 'dark',
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light'
}
