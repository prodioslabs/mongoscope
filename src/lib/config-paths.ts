import { homedir } from 'node:os'
import { join } from 'node:path'

const APP_DIR_NAME = 'mongoscope'
const APP_CONFIG_FILE_NAME = 'config.json'
const USER_THEMES_DIR_NAME = 'themes'

export function resolveConfigDir(
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = homedir(),
): string {
  const xdgConfigHome = env.XDG_CONFIG_HOME?.trim()
  if (xdgConfigHome) {
    return join(xdgConfigHome, APP_DIR_NAME)
  }
  return join(homeDirectory, '.config', APP_DIR_NAME)
}

export function appConfigFilePath(
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = homedir(),
): string {
  return join(resolveConfigDir(env, homeDirectory), APP_CONFIG_FILE_NAME)
}

export function userThemesDir(
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = homedir(),
): string {
  return join(resolveConfigDir(env, homeDirectory), USER_THEMES_DIR_NAME)
}
