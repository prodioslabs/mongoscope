import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { ConnectionProfile, ConnectionsFile } from './types'

const APP_DIR_NAME = 'mongoscope'
const CONNECTIONS_FILE_NAME = 'connections.json'

export function resolveConfigDir(
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = homedir(),
): string {
  const xdgConfigHome = env.XDG_CONFIG_HOME?.trim()
  if (xdgConfigHome) {
    return join(xdgConfigHome, APP_DIR_NAME)
  } else {
    return join(homeDirectory, '.config', APP_DIR_NAME)
  }
}

export function connectionsFilePath(
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = homedir(),
): string {
  return join(resolveConfigDir(env, homeDirectory), CONNECTIONS_FILE_NAME)
}

export function emptyConnectionsFile(): ConnectionsFile {
  return { version: 1, connections: [] }
}

/**
 * Load and validate connections metadata. Missing file → empty store.
 */
export async function loadConnections(
  filePath: string = connectionsFilePath(),
): Promise<ConnectionsFile> {
  let fileContents: string
  try {
    fileContents = await readFile(filePath, 'utf8')
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return emptyConnectionsFile()
    }
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(fileContents)
  } catch {
    throw new Error(`Invalid connections config: ${filePath} is not valid JSON`)
  }

  return validateConnectionsFile(parsed, filePath)
}

/**
 * Atomically write connections metadata (tmp file in the same directory + rename).
 */
export async function saveConnections(
  file: ConnectionsFile,
  filePath: string = connectionsFilePath(),
): Promise<void> {
  validateConnectionsFile(file, filePath)

  const directoryPath = dirname(filePath)
  await mkdir(directoryPath, { recursive: true })

  const temporaryFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  const serialized = `${JSON.stringify(file, null, 2)}\n`

  try {
    await writeFile(temporaryFilePath, serialized, { encoding: 'utf8', mode: 0o600 })
    await rename(temporaryFilePath, filePath)
  } catch (error) {
    try {
      await unlink(temporaryFilePath)
    } catch {
      // ignore cleanup failure
    }
    throw error
  }
}

export function validateConnectionsFile(value: unknown, filePath?: string): ConnectionsFile {
  const locationSuffix = filePath ? ` in ${filePath}` : ''

  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid connections config${locationSuffix}: expected an object`)
  }

  const record = value as Record<string, unknown>

  if (record.version !== 1) {
    throw new Error(
      `Invalid connections config${locationSuffix}: unsupported version (expected 1)`,
    )
  }

  if (!Array.isArray(record.connections)) {
    throw new Error(`Invalid connections config${locationSuffix}: connections must be an array`)
  }

  const connections: ConnectionProfile[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  for (let index = 0; index < record.connections.length; index++) {
    const entry = record.connections[index]
    const profile = validateConnectionProfile(
      entry,
      `${locationSuffix} (connections[${index}])`,
    )
    if (seenIds.has(profile.id)) {
      throw new Error(`Invalid connections config${locationSuffix}: duplicate id ${profile.id}`)
    }
    const normalizedName = profile.name.toLowerCase()
    if (seenNames.has(normalizedName)) {
      throw new Error(
        `Invalid connections config${locationSuffix}: duplicate name ${profile.name}`,
      )
    }
    seenIds.add(profile.id)
    seenNames.add(normalizedName)
    connections.push(profile)
  }

  return { version: 1, connections }
}

function validateConnectionProfile(value: unknown, locationSuffix: string): ConnectionProfile {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid connection profile${locationSuffix}: expected an object`)
  }

  const record = value as Record<string, unknown>
  const id = requireNonEmptyString(record.id, 'id', locationSuffix)
  const name = requireNonEmptyString(record.name, 'name', locationSuffix)
  const hostLabel = requireNonEmptyString(record.hostLabel, 'hostLabel', locationSuffix)
  const createdAt = requireNonEmptyString(record.createdAt, 'createdAt', locationSuffix)

  if (!Array.isArray(record.tags) || record.tags.some((tag) => typeof tag !== 'string')) {
    throw new Error(
      `Invalid connection profile${locationSuffix}: tags must be an array of strings`,
    )
  }

  return {
    id,
    name,
    hostLabel,
    tags: record.tags.slice(),
    createdAt,
  }
}

function requireNonEmptyString(value: unknown, field: string, locationSuffix: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Invalid connection profile${locationSuffix}: ${field} must be a non-empty string`,
    )
  }
  return value
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error != null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  )
}
