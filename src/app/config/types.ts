export const DEFAULT_THEME_NAME = 'gruvbox'

export type AppConfig = {
  version: 1
  /** Selected theme name (not a palette). */
  theme: string
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  version: 1,
  theme: DEFAULT_THEME_NAME,
}
