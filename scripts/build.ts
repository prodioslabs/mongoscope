#!/usr/bin/env bun

/**
 * Compile mongoscope standalone binaries.
 *
 * Default: native platform only → dist/mongoscope(.exe)
 * Release: TARGETS=all (or --all) → all five GitHub Release targets + tar.gz/zip + checksums.txt
 *
 * OpenTUI: Linux builds define OPENTUI_LIBC so only one native libc package is embedded.
 * Cross-compiling requires optional packages: bun install --os="*" --cpu="*" @opentui/core@…
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { $ } from 'bun'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const releaseDir = join(distDir, 'release')
const entrypoint = join(root, 'src', 'cli', 'index.ts')

type BunCompileTarget =
  | 'bun-linux-x64'
  | 'bun-linux-arm64'
  | 'bun-darwin-x64'
  | 'bun-darwin-arm64'
  | 'bun-windows-x64'

type CompileTarget = {
  /** Bun --compile --target value */
  bunTarget: BunCompileTarget
  /** install.sh OS key */
  os: 'linux' | 'darwin' | 'windows'
  /** install.sh arch key (amd64 | arm64) */
  arch: 'amd64' | 'arm64'
  /** OpenTUI libc define for Linux only */
  libc?: 'glibc' | 'musl'
  binaryName: string
}

/** Five targets required for GitHub Releases. */
const RELEASE_TARGETS: readonly CompileTarget[] = [
  {
    bunTarget: 'bun-linux-x64',
    os: 'linux',
    arch: 'amd64',
    libc: 'glibc',
    binaryName: 'mongoscope',
  },
  {
    bunTarget: 'bun-linux-arm64',
    os: 'linux',
    arch: 'arm64',
    libc: 'glibc',
    binaryName: 'mongoscope',
  },
  {
    bunTarget: 'bun-darwin-x64',
    os: 'darwin',
    arch: 'amd64',
    binaryName: 'mongoscope',
  },
  {
    bunTarget: 'bun-darwin-arm64',
    os: 'darwin',
    arch: 'arm64',
    binaryName: 'mongoscope',
  },
  {
    bunTarget: 'bun-windows-x64',
    os: 'windows',
    arch: 'amd64',
    binaryName: 'mongoscope.exe',
  },
]

function packageVersion(): string {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
    version?: string
  }
  if (typeof pkg.version !== 'string' || pkg.version.trim() === '') {
    throw new Error('package.json is missing a version field')
  }
  return pkg.version.trim()
}

function nativeTarget(): CompileTarget {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'linux' && arch === 'x64') {
    return RELEASE_TARGETS[0]!
  }
  if (platform === 'linux' && arch === 'arm64') {
    return RELEASE_TARGETS[1]!
  }
  if (platform === 'darwin' && arch === 'x64') {
    return RELEASE_TARGETS[2]!
  }
  if (platform === 'darwin' && arch === 'arm64') {
    return RELEASE_TARGETS[3]!
  }
  if (platform === 'win32' && arch === 'x64') {
    return RELEASE_TARGETS[4]!
  }

  throw new Error(`Unsupported native platform for compile: ${platform}/${arch}`)
}

function wantAllTargets(): boolean {
  if (process.env.TARGETS === 'all' || process.env.RELEASE === '1') {
    return true
  }
  return process.argv.includes('--all')
}

function archiveBaseName(version: string, target: CompileTarget): string {
  return `mongoscope_${version}_${target.os}_${target.arch}`
}

async function compileOne(
  target: CompileTarget,
  outfile: string,
  embeddedVersion: string,
): Promise<void> {
  mkdirSync(dirname(outfile), { recursive: true })

  const define: Record<string, string> = {
    'process.env.MONGOSCOPE_EMBEDDED_VERSION': JSON.stringify(embeddedVersion),
  }
  if (target.libc != null) {
    define['process.env.OPENTUI_LIBC'] = JSON.stringify(target.libc)
  }

  const result = await Bun.build({
    entrypoints: [entrypoint],
    compile: {
      target: target.bunTarget,
      outfile,
    },
    define,
  })

  if (!result.success) {
    for (const log of result.logs) {
      // oxlint-disable-next-line no-console
      console.error(log)
    }
    throw new Error(`Compile failed for ${target.bunTarget}`)
  }
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

async function packageArchive(
  version: string,
  target: CompileTarget,
  binaryPath: string,
): Promise<string> {
  const base = archiveBaseName(version, target)
  const staging = join(releaseDir, 'staging', base)
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })

  const stagedBinary = join(staging, target.binaryName)
  await $`cp ${binaryPath} ${stagedBinary}`
  await $`chmod 755 ${stagedBinary}`.nothrow()

  if (target.os === 'windows') {
    const zipPath = join(releaseDir, `${base}.zip`)
    rmSync(zipPath, { force: true })
    // zip from inside staging so the archive root is the binary name
    await $`cd ${staging} && zip -q ${zipPath} ${target.binaryName}`
    return zipPath
  }

  const tarPath = join(releaseDir, `${base}.tar.gz`)
  rmSync(tarPath, { force: true })
  await $`tar -czf ${tarPath} -C ${staging} ${target.binaryName}`
  return tarPath
}

function writeChecksums(): void {
  const lines: string[] = []
  for (const name of readdirSync(releaseDir).sort()) {
    if (name === 'checksums.txt' || name === 'staging') {
      continue
    }
    if (!name.endsWith('.tar.gz') && !name.endsWith('.zip')) {
      continue
    }
    const digest = sha256File(join(releaseDir, name))
    lines.push(`${digest}  ${name}`)
  }
  writeFileSync(join(releaseDir, 'checksums.txt'), `${lines.join('\n')}\n`, 'utf8')
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

async function main(): Promise<void> {
  const version = packageVersion()
  const all = wantAllTargets()

  // Fresh tree — drop stale ELF / prior release artifacts.
  rmSync(distDir, { recursive: true, force: true })
  mkdirSync(distDir, { recursive: true })

  const targets = all ? [...RELEASE_TARGETS] : [nativeTarget()]

  // oxlint-disable-next-line no-console
  console.log(`Building mongoscope ${version} (${targets.map((t) => t.bunTarget).join(', ')})`)

  if (all) {
    mkdirSync(releaseDir, { recursive: true })
  }

  for (const target of targets) {
    const outName = all
      ? `mongoscope-${target.os}-${target.arch}${target.os === 'windows' ? '.exe' : ''}`
      : target.binaryName
    const outfile = join(distDir, outName)

    // oxlint-disable-next-line no-console
    console.log(`→ ${target.bunTarget} → ${outfile}`)
    await compileOne(target, outfile, version)

    const size = Bun.file(outfile).size
    // oxlint-disable-next-line no-console
    console.log(`  size ${formatBytes(size)}`)

    if (all) {
      const archive = await packageArchive(version, target, outfile)
      // oxlint-disable-next-line no-console
      console.log(`  packaged ${archive}`)
    }
  }

  if (all) {
    writeChecksums()
    // oxlint-disable-next-line no-console
    console.log(`Wrote ${join(releaseDir, 'checksums.txt')}`)
  }

  // Spot-check native binary when we built it.
  const native = nativeTarget()
  const nativeOut = all
    ? join(
        distDir,
        `mongoscope-${native.os}-${native.arch}${native.os === 'windows' ? '.exe' : ''}`,
      )
    : join(distDir, native.binaryName)

  if (targets.some((t) => t.bunTarget === native.bunTarget)) {
    const result = await $`${nativeOut} --version`.quiet()
    const printed = result.stdout.toString().trim()
    if (result.exitCode !== 0 || printed !== version) {
      throw new Error(
        `Native binary --version check failed (exit ${result.exitCode}, out=${JSON.stringify(printed)})`,
      )
    }
    // oxlint-disable-next-line no-console
    console.log(`Verified ${nativeOut} --version → ${printed}`)
  }

  // oxlint-disable-next-line no-console
  console.log('Done.')
}

await main()
