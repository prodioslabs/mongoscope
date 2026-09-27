import type { CliRenderer } from '@opentui/core'
import { randomBytes } from 'node:crypto'
import { chmod, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, normalize } from 'node:path'
import { MAX_READ_BYTES } from '../../parser'
import { isMongoLogFile, type ListLogFilesResult } from './list-log-files'

/** Hard timeout while waiting on an interactive sudo prompt. */
const SUDO_TIMEOUT_MS = 90_000

export type ElevatedFailureKind =
  | 'cancelled'
  | 'denied'
  | 'sudo_missing'
  | 'timeout'
  | 'invalid_path'
  | 'other'

export type ElevatedResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: ElevatedFailureKind; message: string }

export type SuspendableRenderer = Pick<CliRenderer, 'suspend' | 'resume'>

export type ElevatedSpawnResult = {
  stdout: ReadableStream<Uint8Array> | null
  exited: Promise<number>
  kill: (signal?: number | NodeJS.Signals) => boolean
  /** Present when the process was killed by a signal (Bun). */
  signalCode?: NodeJS.Signals | number | null
}

export type ElevatedSpawn = (
  command: string[],
  options: {
    stdin: 'inherit'
    stdout: 'pipe'
    stderr: 'inherit'
  },
) => ElevatedSpawnResult

const sessionElevatedDirectories = new Set<string>()

const FAILURE_MESSAGE: Record<ElevatedFailureKind, string> = {
  cancelled: 'Elevated access cancelled.',
  denied: 'Incorrect password or sudo denied.',
  sudo_missing: 'sudo is not available on this system.',
  timeout: 'Timed out waiting for sudo. Try again.',
  invalid_path: 'Refusing elevated access: path must be absolute and must not contain ..',
  other: 'Elevated access failed.',
}

export function elevatedFailureMessage(kind: ElevatedFailureKind): string {
  return FAILURE_MESSAGE[kind]
}

/**
 * Absolute paths only; reject any `..` segment before normalize/spawn.
 * Does not resolve symlinks — callers pass the path the user selected.
 */
export function validateElevatedPath(path: string): ElevatedResult<string> {
  if (path === '' || path.includes('\0')) {
    return { ok: false, kind: 'invalid_path', message: FAILURE_MESSAGE.invalid_path }
  }
  if (!isAbsolute(path)) {
    return { ok: false, kind: 'invalid_path', message: FAILURE_MESSAGE.invalid_path }
  }
  const segments = path.split(/[/\\]/)
  if (segments.some((segment) => segment === '..')) {
    return { ok: false, kind: 'invalid_path', message: FAILURE_MESSAGE.invalid_path }
  }
  return { ok: true, value: normalize(path) }
}

export function isDirectorySessionElevated(dir: string): boolean {
  const validated = validateElevatedPath(dir)
  if (!validated.ok) {
    return false
  }
  return sessionElevatedDirectories.has(validated.value)
}

function markDirectorySessionElevated(dir: string): void {
  const validated = validateElevatedPath(dir)
  if (!validated.ok) {
    return
  }
  sessionElevatedDirectories.add(validated.value)
}

/** Test helper — clears Welcome-session elevate approvals. */
export function clearSessionElevatedDirectories(): void {
  sessionElevatedDirectories.clear()
}

export function isFsPermissionDeniedError(error: unknown): boolean {
  return isNodeErrnoException(error) && (error.code === 'EACCES' || error.code === 'EPERM')
}

export function isPermissionDeniedMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return lower.includes('eacces') || lower.includes('eperm') || lower.includes('permission denied')
}

type RunElevatedCommandOptions = {
  renderer: SuspendableRenderer
  /** Arguments after `sudo --` (e.g. `['ls', '-1A', dir]`). Never a shell string. */
  argvAfterSudo: readonly string[]
  timeoutMs?: number
  spawn?: ElevatedSpawn
}

/**
 * Suspend the TUI, run `sudo -- <argv…>` with inherited stdin/stderr (password prompt),
 * pipe stdout, then always resume — including cancel / timeout / error.
 */
export async function runElevatedCommand(
  options: RunElevatedCommandOptions,
): Promise<ElevatedResult<Uint8Array>> {
  const timeoutMs = options.timeoutMs ?? SUDO_TIMEOUT_MS
  const spawn = options.spawn ?? defaultBunSpawn
  const command = ['sudo', '--', ...options.argvAfterSudo]

  options.renderer.suspend()
  let timedOut = false
  let proc: ElevatedSpawnResult | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    try {
      proc = spawn(command, {
        stdin: 'inherit',
        stdout: 'pipe',
        stderr: 'inherit',
      })
    } catch (error) {
      if (isEnoent(error)) {
        return { ok: false, kind: 'sudo_missing', message: FAILURE_MESSAGE.sudo_missing }
      }
      return {
        ok: false,
        kind: 'other',
        message: error instanceof Error ? error.message : FAILURE_MESSAGE.other,
      }
    }

    timer = setTimeout(function killSudoOnTimeout() {
      timedOut = true
      proc?.kill('SIGKILL')
    }, timeoutMs)

    const exitCode = await proc.exited
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }

    if (timedOut) {
      return { ok: false, kind: 'timeout', message: FAILURE_MESSAGE.timeout }
    }

    const signal = proc.signalCode ?? null
    if (signal === 'SIGINT' || signal === 'SIGTERM' || signal === 2 || signal === 15) {
      return { ok: false, kind: 'cancelled', message: FAILURE_MESSAGE.cancelled }
    }

    if (exitCode !== 0) {
      // Wrong password, auth failure, or most password-prompt cancels surface as exit 1.
      if (exitCode === 1) {
        return { ok: false, kind: 'denied', message: FAILURE_MESSAGE.denied }
      }
      return {
        ok: false,
        kind: 'other',
        message: FAILURE_MESSAGE.other,
      }
    }

    const stdout =
      proc.stdout != null
        ? new Uint8Array(await new Response(proc.stdout).arrayBuffer())
        : new Uint8Array()
    return { ok: true, value: stdout }
  } finally {
    if (timer !== null) {
      clearTimeout(timer)
    }
    options.renderer.resume()
  }
}

type ListLogFilesElevatedOptions = {
  renderer: SuspendableRenderer
  dir: string
  timeoutMs?: number
  spawn?: ElevatedSpawn
  /** When true, mark the directory session-elevated after a successful list. Default true. */
  markApproved?: boolean
}

/**
 * Elevated non-recursive directory listing via `sudo -- ls -1A <dir>`.
 * Filters to MongoDB-like log names (mtime order not available without extra sudo calls).
 */
export async function listLogFilesElevated(
  options: ListLogFilesElevatedOptions,
): Promise<ElevatedResult<ListLogFilesResult>> {
  const validated = validateElevatedPath(options.dir)
  if (!validated.ok) {
    return validated
  }

  const listed = await runElevatedCommand({
    renderer: options.renderer,
    argvAfterSudo: ['ls', '-1A', validated.value],
    timeoutMs: options.timeoutMs,
    spawn: options.spawn,
  })
  if (!listed.ok) {
    return listed
  }

  const names = new TextDecoder()
    .decode(listed.value)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && isMongoLogFile(line))

  const list: ListLogFilesResult =
    names.length === 0 ? { status: 'empty' } : { status: 'ok', files: names }

  if (options.markApproved !== false) {
    markDirectorySessionElevated(validated.value)
  }

  return { ok: true, value: list }
}

type MaterializeLogFileTailElevatedOptions = {
  renderer: SuspendableRenderer
  path: string
  /** Bytes from EOF to copy (capped). Defaults to parser {@link MAX_READ_BYTES}. */
  maxBytes?: number
  timeoutMs?: number
  spawn?: ElevatedSpawn
}

/**
 * Copy the last `maxBytes` of a log file via `sudo -- tail -c …` into a user-owned
 * `0600` temp file. Caller must unlink when done (session teardown).
 */
export async function materializeLogFileTailElevated(
  options: MaterializeLogFileTailElevatedOptions,
): Promise<ElevatedResult<string>> {
  const validated = validateElevatedPath(options.path)
  if (!validated.ok) {
    return validated
  }
  const base = basename(validated.value)
  if (base === '' || base === '.' || base === '..') {
    return { ok: false, kind: 'invalid_path', message: FAILURE_MESSAGE.invalid_path }
  }

  const maxBytes = Math.max(1, Math.min(options.maxBytes ?? MAX_READ_BYTES, MAX_READ_BYTES))
  const tailed = await runElevatedCommand({
    renderer: options.renderer,
    argvAfterSudo: ['tail', '-c', String(maxBytes), validated.value],
    timeoutMs: options.timeoutMs,
    spawn: options.spawn,
  })
  if (!tailed.ok) {
    return tailed
  }

  const tempPath = join(tmpdir(), `mongoscope-elevated-${randomBytes(8).toString('hex')}.log`)
  try {
    await writeFile(tempPath, tailed.value, { mode: 0o600 })
    await chmod(tempPath, 0o600)
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    return {
      ok: false,
      kind: 'other',
      message: error instanceof Error ? error.message : FAILURE_MESSAGE.other,
    }
  }

  markDirectorySessionElevated(dirname(validated.value))
  return { ok: true, value: tempPath }
}

export async function unlinkElevatedTempFile(tempPath: string | null | undefined): Promise<void> {
  if (tempPath == null || tempPath === '') {
    return
  }
  await unlink(tempPath).catch(() => undefined)
}

function defaultBunSpawn(
  command: string[],
  options: {
    stdin: 'inherit'
    stdout: 'pipe'
    stderr: 'inherit'
  },
): ElevatedSpawnResult {
  const proc = Bun.spawn(command, options)
  return {
    stdout: proc.stdout,
    exited: proc.exited,
    kill: (signal) => {
      proc.kill(signal)
      return true
    },
    get signalCode() {
      return proc.signalCode
    },
  }
}

function isEnoent(error: unknown): boolean {
  return isNodeErrnoException(error) && error.code === 'ENOENT'
}

function isNodeErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error != null && 'code' in error
}
