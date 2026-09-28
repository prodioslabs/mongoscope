import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { userThemesDir } from '../../lib/config-paths'
import { errorMessageText } from '../../lib/error-message'
import { isTheme, resolveTheme, type ThemeJson } from './default-themes'

const REQUIRED_THEME_COLOR_KEYS = [
  'primary',
  'secondary',
  'accent',
  'text',
  'textMuted',
  'background',
] as const

type UserThemesLoadResult = {
  themes: Record<string, ThemeJson>
  warnings: string[]
}

/**
 * Scan `themesDir` for `*.json` theme files.
 * Invalid files are skipped with a warning; catalog load continues.
 * Theme name = basename without `.json`.
 */
export async function loadUserThemes(
  themesDirectory: string = userThemesDir(),
): Promise<UserThemesLoadResult> {
  const themes: Record<string, ThemeJson> = {}
  const warnings: string[] = []

  let entries: string[]
  try {
    entries = await readdir(themesDirectory)
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return { themes, warnings }
    }
    warnings.push(
      `Failed to read user themes directory ${themesDirectory}: ${errorMessageText(error)}`,
    )
    return { themes, warnings }
  }

  for (const entryName of entries) {
    if (!entryName.endsWith('.json')) {
      continue
    }

    const themeName = entryName.slice(0, -'.json'.length)
    if (themeName === '') {
      warnings.push(`Skipped theme file with empty name: ${entryName}`)
      continue
    }

    const filePath = join(themesDirectory, entryName)
    try {
      const fileContents = await readFile(filePath, 'utf8')
      let parsed: unknown
      try {
        parsed = JSON.parse(fileContents)
      } catch {
        throw new Error('file is not valid JSON')
      }
      themes[themeName] = validateUserThemeJson(parsed)
    } catch (error) {
      warnings.push(`Skipped user theme "${themeName}" (${filePath}): ${errorMessageText(error)}`)
    }
  }

  return { themes, warnings }
}

function validateUserThemeJson(value: unknown): ThemeJson {
  if (!isTheme(value)) {
    throw new Error('expected an object with a theme object')
  }

  for (const key of REQUIRED_THEME_COLOR_KEYS) {
    if (value.theme[key] === undefined) {
      throw new Error(`missing required theme color "${key}"`)
    }
  }

  resolveTheme(value, 'dark')
  resolveTheme(value, 'light')

  return value
}

function isFileNotFoundError(error: unknown): boolean {
  return isNodeErrnoException(error) && error.code === 'ENOENT'
}

function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error != null && 'code' in error
}
