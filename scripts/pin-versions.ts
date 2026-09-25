#!/usr/bin/env bun

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cancel, intro, log, outro } from '@clack/prompts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const packageJsonPath = join(root, 'package.json')
const require = createRequire(packageJsonPath)

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const

type DependencyField = (typeof DEPENDENCY_FIELDS)[number]

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
type JsonObject = { [key: string]: JsonValue }

/** package.json fields this script mutates, plus passthrough for other keys. */
type PackageJson = Partial<Record<DependencyField, Record<string, string>>> & JsonObject

/**
 * Bun lockfile v1 `packages` entry: `[pkgId, info, deps?, integrity?, ...]`.
 * Only `entry[0]` (resolved id) is used here.
 */
type BunLockPackageEntry = readonly [id: string, ...rest: JsonValue[]]

type BunLockfile = {
  lockfileVersion?: number
  packages?: Record<string, BunLockPackageEntry>
}

type InstalledPackageJson = {
  version?: string
}

function isPinned(version: string): boolean {
  if (version === 'latest' || version === '*') {
    return false
  }

  if (/^[\^~*]/.test(version) || /^[<>]/.test(version) || version.includes('||')) {
    return false
  }

  return true
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isStringRecord(value: JsonValue | undefined): value is Record<string, string> {
  if (value === undefined || !isJsonObject(value)) {
    return false
  }

  return Object.values(value).every((entry) => typeof entry === 'string')
}

function parseJsonObject(text: string): JsonObject {
  const parsed: unknown = JSON.parse(text)
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected a JSON object')
  }
  return parsed as JsonObject
}

function parseBunLockfile(text: string): BunLockfile {
  const obj = parseJsonObject(text)
  const packagesValue = obj.packages
  if (packagesValue !== undefined && !isJsonObject(packagesValue)) {
    throw new Error('bun.lock packages must be an object')
  }

  const packages: Record<string, BunLockPackageEntry> | undefined =
    packagesValue === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(packagesValue).flatMap(([name, entry]) => {
            if (!Array.isArray(entry) || typeof entry[0] !== 'string') {
              return []
            }
            const packageEntry: BunLockPackageEntry = [entry[0], ...entry.slice(1)]
            return [[name, packageEntry]]
          }),
        )

  return {
    lockfileVersion: typeof obj.lockfileVersion === 'number' ? obj.lockfileVersion : undefined,
    packages,
  }
}

function parsePackageJson(text: string): PackageJson {
  const obj = parseJsonObject(text)
  const result: PackageJson = { ...obj }

  for (const field of DEPENDENCY_FIELDS) {
    const value = obj[field]
    if (value === undefined) {
      continue
    }
    if (!isStringRecord(value)) {
      throw new Error(`package.json ${field} must be a string map`)
    }
    result[field] = value
  }

  return result
}

function parseInstalledPackageJson(text: string): InstalledPackageJson {
  const obj = parseJsonObject(text)
  return {
    version: typeof obj.version === 'string' ? obj.version : undefined,
  }
}

function resolveFromBunLock(packageName: string): string | null {
  const lockPath = join(root, 'bun.lock')
  if (!existsSync(lockPath)) {
    return null
  }

  const lock = parseBunLockfile(readFileSync(lockPath, 'utf-8'))
  const entry = lock.packages?.[packageName]
  if (!entry) {
    return null
  }

  const id = entry[0]
  const prefix = `${packageName}@`

  if (!id.startsWith(prefix)) {
    return null
  }

  return id.slice(prefix.length)
}

function resolveInstalledVersion(packageName: string): string | null {
  let pkgJsonPath: string
  try {
    pkgJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [root],
    })
  } catch {
    return resolveFromBunLock(packageName)
  }

  const installed = parseInstalledPackageJson(readFileSync(pkgJsonPath, 'utf-8'))

  if (typeof installed.version !== 'string') {
    throw new Error(`${packageName}/package.json has no version field`)
  }

  return installed.version
}

function main() {
  intro('Pin package versions')

  const pkg = parsePackageJson(readFileSync(packageJsonPath, 'utf-8'))
  const changes: Array<{
    field: DependencyField
    name: string
    from: string
    to: string
  }> = []

  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field]
    if (!deps) {
      continue
    }

    for (const [name, version] of Object.entries(deps)) {
      if (isPinned(version)) {
        continue
      }

      const resolved = resolveInstalledVersion(name)
      if (!resolved) {
        cancel(`Could not resolve installed version for ${name} (${version}). Run install first.`)
        process.exit(1)
      }

      if (resolved !== version) {
        changes.push({ field, name, from: version, to: resolved })
        deps[name] = resolved
      }
    }
  }

  if (changes.length === 0) {
    outro('All package versions are already pinned.')
    return
  }

  writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`)

  for (const { field, name, from, to } of changes) {
    log.step(`${field}.${name}: ${from} -> ${to}`)
  }

  outro(`Pinned ${changes.length} package version(s) in package.json.`)
}

main()
