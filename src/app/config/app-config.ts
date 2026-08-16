import { appConfigFilePath } from '../../lib/config-paths'
import { loadJsonConfigFile, saveJsonConfigFile } from '../../lib/json-config-file'
import { DEFAULT_APP_CONFIG, type AppConfig } from './types'

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

  return {
    version: 1,
    theme: record.theme.trim(),
  }
}

/**
 * Load ~/.config/mongoscope/config.json.
 * Missing / corrupt / unsupported → DEFAULT_APP_CONFIG (no throw to caller for boot).
 */
export async function loadAppConfig(filePath: string = appConfigFilePath()): Promise<AppConfig> {
  try {
    return await loadJsonConfigFile(filePath, DEFAULT_APP_CONFIG, validateAppConfig)
  } catch {
    return DEFAULT_APP_CONFIG
  }
}

export async function saveAppConfigTheme(
  themeName: string,
  filePath: string = appConfigFilePath(),
): Promise<void> {
  const theme = themeName.trim()
  if (theme === '') {
    throw new Error('theme must be a non-empty string')
  }
  const config: AppConfig = { version: 1, theme }
  await saveJsonConfigFile(filePath, config)
}
