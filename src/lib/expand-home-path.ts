import { homedir } from 'node:os'
import { resolve } from 'node:path'

/**
 * Expand a leading `~` / `~/…` to the home directory. Other paths are returned trimmed.
 */
export function expandHomePath(input: string, homeDirectory: string = homedir()): string {
  const trimmed = input.trim()
  if (trimmed === '~') {
    return homeDirectory
  }
  if (trimmed.startsWith('~/')) {
    return `${homeDirectory}/${trimmed.slice(2)}`
  }
  return trimmed
}

/**
 * Expand `~` then resolve to an absolute path against `cwd`.
 */
export function resolveUserPath(
  input: string,
  cwd: string = process.cwd(),
  homeDirectory: string = homedir(),
): string {
  return resolve(cwd, expandHomePath(input, homeDirectory))
}
