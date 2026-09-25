import { appConfigFilePath } from '../../lib/config-paths'
import { loadJsonConfigFile, saveJsonConfigFile } from '../../lib/json-config-file'
import {
  DEFAULT_APP_CONFIG,
  isThemeMode,
  type AppConfig,
  type ThemeMode,
} from './types'

export function validateAppConfig(value: unknown): AppConfig {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid app config: expected an object')
  }

  const record = value as Record<string, unknown>

  if (record.version !== 1) {
    throw new Error('Invalid app config: unsupported version (expected 1)')
  }

  if (typeof record.theme !== 'string' || record.theme.trim() === '') {
    throw new Error('Invalid app config: theme must be a non-empty string')
  }

  // Older configs omitted mode — default to dark rather than rejecting.
  let mode: ThemeMode = DEFAULT_APP_CONFIG.mode
  if (record.mode !== undefined) {
    if (!isThemeMode(record.mode)) {
      throw new Error('Invalid app config: mode must be "dark" or "light"')
    }
    mode = record.mode
  }

  return {
    version: 1,
    theme: record.theme.trim(),
    mode,
  }
}

/**
 * Load ~/.config/mongoscope/config.json.
 * Missing file → {@link DEFAULT_APP_CONFIG}. Corrupt / unsupported → throws (boot catches).
 */
export async function loadAppConfig(filePath: string = appConfigFilePath()): Promise<AppConfig> {
  return loadJsonConfigFile(filePath, DEFAULT_APP_CONFIG, validateAppConfig)
}

export async function saveAppConfig(
  input: { theme: string; mode: ThemeMode },
  filePath: string = appConfigFilePath(),
): Promise<void> {
  const theme = input.theme.trim()
  if (theme === '') {
    throw new Error('theme must be a non-empty string')
  }
  if (!isThemeMode(input.mode)) {
    throw new Error('mode must be "dark" or "light"')
  }
  const config: AppConfig = { version: 1, theme, mode: input.mode }
  await saveJsonConfigFile(filePath, config)
}
