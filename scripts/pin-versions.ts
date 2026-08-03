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

type PackageJson = {
  [key: string]: unknown
} & Partial<Record<DependencyField, Record<string, string>>>

function isPinned(version: string): boolean {
  if (version === 'latest' || version === '*') {
    return false
  }

  if (/^[\^~*]/.test(version) || /^[<>]/.test(version) || version.includes('||')) {
    return false
  }

  return true
}

function resolveFromBunLock(packageName: string): string | null {
  const lockPath = join(root, 'bun.lock')
  if (!existsSync(lockPath)) {
    return null
  }

  const lock = JSON.parse(readFileSync(lockPath, 'utf-8')) as {
    packages?: Record<string, [string, ...unknown[]]>
  }

  const entry = lock.packages?.[packageName]
  if (!entry || typeof entry[0] !== 'string') {
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
  try {
    const pkgJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [root],
    })
    const installed = JSON.parse(readFileSync(pkgJsonPath, 'utf-8')) as {
      version?: string
    }

    return installed.version ?? null
  } catch {
    return resolveFromBunLock(packageName)
  }
}

function main() {
  intro('Pin package versions')

  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJson
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
