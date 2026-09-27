import { access, chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearSessionElevatedDirectories,
  elevatedFailureMessage,
  isDirectorySessionElevated,
  listLogFilesElevated,
  materializeLogFileTailElevated,
  runElevatedCommand,
  unlinkElevatedTempFile,
  validateElevatedPath,
  type ElevatedSpawn,
  type ElevatedSpawnResult,
  type SuspendableRenderer,
} from './elevated-log-access'
import { listLogFiles } from './list-log-files'

const tempRoots: string[] = []

afterEach(async () => {
  clearSessionElevatedDirectories()
  for (const root of tempRoots.splice(0)) {
    await chmod(root, 0o755).catch(() => undefined)
    await rm(root, { recursive: true, force: true })
  }
})

beforeEach(() => {
  clearSessionElevatedDirectories()
})

async function makeTempDir(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mongoscope-elevated-'))
  tempRoots.push(root)
  return root
}

function createMockRenderer(): SuspendableRenderer & {
  suspendCalls: number
  resumeCalls: number
} {
  const renderer = {
    suspendCalls: 0,
    resumeCalls: 0,
    suspend() {
      renderer.suspendCalls += 1
    },
    resume() {
      renderer.resumeCalls += 1
    },
  }
  return renderer
}

function mockSpawnFrom(factory: (command: string[]) => ElevatedSpawnResult): ElevatedSpawn {
  return function spawn(command) {
    return factory(command)
  }
}

function expectResumeAfterSuspend(
  renderer: ReturnType<typeof createMockRenderer>,
  options?: { suspended?: boolean },
) {
  const suspended = options?.suspended ?? true
  if (suspended) {
    expect(renderer.suspendCalls).toBe(1)
  } else {
    expect(renderer.suspendCalls).toBe(0)
  }
  // resume must always run when suspend ran; path-validation failures never suspend.
  expect(renderer.resumeCalls).toBe(renderer.suspendCalls)
}

describe('validateElevatedPath', () => {
  it('accepts absolute paths without ..', () => {
    expect(validateElevatedPath('/var/log/mongodb')).toEqual({
      ok: true,
      value: '/var/log/mongodb',
    })
  })

  it('rejects relative paths and .. segments before any spawn', () => {
    expect(validateElevatedPath('var/log/mongodb')).toEqual({
      ok: false,
      kind: 'invalid_path',
      message: elevatedFailureMessage('invalid_path'),
    })
    expect(validateElevatedPath('/var/log/../mongodb').ok).toBe(false)
    expect(validateElevatedPath('/var/log/mongodb/..').ok).toBe(false)
  })
})

describe('runElevatedCommand', () => {
  it('builds argv as [sudo, --, ...argvAfterSudo] with no shell string', async () => {
    const renderer = createMockRenderer()
    const captured: string[] = []
    const result = await runElevatedCommand({
      renderer,
      argvAfterSudo: ['ls', '-1A', '/var/log/mongodb'],
      spawn: mockSpawnFrom((command) => {
        captured.splice(0, captured.length, ...command)
        return {
          stdout: new Response('').body,
          exited: Promise.resolve(0),
          kill: () => true,
          signalCode: null,
        }
      }),
    })

    expect(result.ok).toBe(true)
    expect(captured).toEqual(['sudo', '--', 'ls', '-1A', '/var/log/mongodb'])
    expect(captured.join(' ').includes('&&')).toBe(false)
    expect(captured.join(' ').includes(';')).toBe(false)
    expectResumeAfterSuspend(renderer)
  })

  it('always resumes after success', async () => {
    const renderer = createMockRenderer()
    const result = await runElevatedCommand({
      renderer,
      argvAfterSudo: ['ls', '-1A', '/tmp'],
      spawn: mockSpawnFrom(() => ({
        stdout: new Response('mongod.log\n').body,
        exited: Promise.resolve(0),
        kill: () => true,
        signalCode: null,
      })),
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(new TextDecoder().decode(result.value)).toBe('mongod.log\n')
    }
    expectResumeAfterSuspend(renderer)
  })

  it('maps exit 1 to denied and still resumes', async () => {
    const renderer = createMockRenderer()
    const result = await runElevatedCommand({
      renderer,
      argvAfterSudo: ['ls', '-1A', '/tmp'],
      spawn: mockSpawnFrom(() => ({
        stdout: new Response('').body,
        exited: Promise.resolve(1),
        kill: () => true,
        signalCode: null,
      })),
    })
    expect(result).toEqual({
      ok: false,
      kind: 'denied',
      message: 'Incorrect password or sudo denied.',
    })
    expectResumeAfterSuspend(renderer)
  })

  it('maps SIGINT to cancelled and still resumes', async () => {
    const renderer = createMockRenderer()
    const result = await runElevatedCommand({
      renderer,
      argvAfterSudo: ['ls', '-1A', '/tmp'],
      spawn: mockSpawnFrom(() => ({
        stdout: new Response('').body,
        exited: Promise.resolve(130),
        kill: () => true,
        signalCode: 'SIGINT',
      })),
    })
    expect(result).toEqual({
      ok: false,
      kind: 'cancelled',
      message: 'Elevated access cancelled.',
    })
    expectResumeAfterSuspend(renderer)
  })

  it('maps spawn ENOENT to sudo_missing and still resumes', async () => {
    const renderer = createMockRenderer()
    const result = await runElevatedCommand({
      renderer,
      argvAfterSudo: ['ls', '-1A', '/tmp'],
      spawn: () => {
        throw Object.assign(new Error('not found'), { code: 'ENOENT' })
      },
    })
    expect(result).toEqual({
      ok: false,
      kind: 'sudo_missing',
      message: 'sudo is not available on this system.',
    })
    expectResumeAfterSuspend(renderer)
  })

  it('kills a hanging child on timeout, returns timeout message, and still resumes', async () => {
    const renderer = createMockRenderer()
    const kill = vi.fn((_signal?: number | NodeJS.Signals) => true)
    let resolveExited: ((code: number) => void) | null = null

    const result = await runElevatedCommand({
      renderer,
      argvAfterSudo: ['ls', '-1A', '/tmp'],
      timeoutMs: 30,
      spawn: mockSpawnFrom(() => ({
        stdout: new Response('').body,
        exited: new Promise<number>((resolve) => {
          resolveExited = resolve
        }),
        kill(signal) {
          kill(signal)
          // Simulate the OS completing the process after SIGKILL.
          resolveExited?.(137)
          return true
        },
        signalCode: null,
      })),
    })

    expect(result).toEqual({
      ok: false,
      kind: 'timeout',
      message: 'Timed out waiting for sudo. Try again.',
    })
    expect(kill).toHaveBeenCalledWith('SIGKILL')
    expectResumeAfterSuspend(renderer)
  })
})

describe('listLogFilesElevated', () => {
  it('returns filtered file list on success and marks the directory session-approved', async () => {
    const dir = await makeTempDir()
    await writeFile(join(dir, 'mongod.log'), 'x\n', 'utf8')
    await writeFile(join(dir, 'readme.txt'), 'x\n', 'utf8')
    await chmod(dir, 0o000)

    // Unprivileged list may be permission_denied (or ok as root); elevated path is under test.
    await listLogFiles(dir)

    const renderer = createMockRenderer()
    const captured: string[] = []
    const result = await listLogFilesElevated({
      renderer,
      dir,
      spawn: mockSpawnFrom((command) => {
        captured.splice(0, captured.length, ...command)
        return {
          stdout: new Response('mongod.log\nreadme.txt\nmongos.log\n').body,
          exited: Promise.resolve(0),
          kill: () => true,
          signalCode: null,
        }
      }),
    })

    expect(captured).toEqual(['sudo', '--', 'ls', '-1A', dir])
    expect(result).toEqual({
      ok: true,
      value: { status: 'ok', files: ['mongod.log', 'mongos.log'] },
    })
    expect(isDirectorySessionElevated(dir)).toBe(true)
    expectResumeAfterSuspend(renderer)

    await chmod(dir, 0o755)
  })

  it('maps denied exit through listLogFilesElevated and still resumes', async () => {
    const dir = await makeTempDir()
    const renderer = createMockRenderer()
    const result = await listLogFilesElevated({
      renderer,
      dir,
      spawn: mockSpawnFrom(() => ({
        stdout: new Response('').body,
        exited: Promise.resolve(1),
        kill: () => true,
        signalCode: null,
      })),
    })
    expect(result).toEqual({
      ok: false,
      kind: 'denied',
      message: 'Incorrect password or sudo denied.',
    })
    expect(isDirectorySessionElevated(dir)).toBe(false)
    expectResumeAfterSuspend(renderer)
  })

  it('maps cancelled signal through listLogFilesElevated and still resumes', async () => {
    const dir = await makeTempDir()
    const renderer = createMockRenderer()
    const result = await listLogFilesElevated({
      renderer,
      dir,
      spawn: mockSpawnFrom(() => ({
        stdout: new Response('').body,
        exited: Promise.resolve(130),
        kill: () => true,
        signalCode: 'SIGINT',
      })),
    })
    expect(result).toEqual({
      ok: false,
      kind: 'cancelled',
      message: 'Elevated access cancelled.',
    })
    expectResumeAfterSuspend(renderer)
  })

  it('maps sudo ENOENT through listLogFilesElevated and still resumes', async () => {
    const dir = await makeTempDir()
    const renderer = createMockRenderer()
    const result = await listLogFilesElevated({
      renderer,
      dir,
      spawn: () => {
        throw Object.assign(new Error('spawn sudo ENOENT'), { code: 'ENOENT' })
      },
    })
    expect(result).toEqual({
      ok: false,
      kind: 'sudo_missing',
      message: 'sudo is not available on this system.',
    })
    expectResumeAfterSuspend(renderer)
  })

  it('times out a hanging list spawn, kills the child, and still resumes', async () => {
    const dir = await makeTempDir()
    const renderer = createMockRenderer()
    const kill = vi.fn((_signal?: number | NodeJS.Signals) => true)
    let resolveExited: ((code: number) => void) | null = null

    const result = await listLogFilesElevated({
      renderer,
      dir,
      timeoutMs: 25,
      spawn: mockSpawnFrom(() => ({
        stdout: new Response('').body,
        exited: new Promise<number>((resolve) => {
          resolveExited = resolve
        }),
        kill(signal) {
          kill(signal)
          resolveExited?.(137)
          return true
        },
        signalCode: null,
      })),
    })

    expect(result).toEqual({
      ok: false,
      kind: 'timeout',
      message: 'Timed out waiting for sudo. Try again.',
    })
    expect(kill).toHaveBeenCalledWith('SIGKILL')
    expect(isDirectorySessionElevated(dir)).toBe(false)
    expectResumeAfterSuspend(renderer)
  })

  it('rejects relative paths before spawn (no suspend/resume)', async () => {
    const renderer = createMockRenderer()
    const spawn = vi.fn()
    const result = await listLogFilesElevated({
      renderer,
      dir: 'var/log/mongodb',
      spawn: spawn as unknown as ElevatedSpawn,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.kind).toBe('invalid_path')
    }
    expect(spawn).not.toHaveBeenCalled()
    expectResumeAfterSuspend(renderer, { suspended: false })
  })

  it('rejects paths containing .. before spawn (no suspend/resume)', async () => {
    const renderer = createMockRenderer()
    const spawn = vi.fn()
    const result = await listLogFilesElevated({
      renderer,
      dir: '/var/log/../mongodb',
      spawn: spawn as unknown as ElevatedSpawn,
    })
    expect(result.ok).toBe(false)
    expect(spawn).not.toHaveBeenCalled()
    expectResumeAfterSuspend(renderer, { suspended: false })
  })
})

describe('materializeLogFileTailElevated', () => {
  it('builds argv [sudo, --, tail, -c, <bytes>, <abs-path>] and writes a temp file', async () => {
    const dir = await makeTempDir()
    const path = join(dir, 'mongod.log')
    const renderer = createMockRenderer()
    const captured: string[] = []

    const result = await materializeLogFileTailElevated({
      renderer,
      path,
      maxBytes: 4096,
      spawn: mockSpawnFrom((command) => {
        captured.splice(0, captured.length, ...command)
        return {
          stdout: new Response('{"t":{}}\n').body,
          exited: Promise.resolve(0),
          kill: () => true,
          signalCode: null,
        }
      }),
    })

    expect(captured).toEqual(['sudo', '--', 'tail', '-c', '4096', path])
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(isDirectorySessionElevated(dir)).toBe(true)
    await access(result.value)
    await unlinkElevatedTempFile(result.value)
    expectResumeAfterSuspend(renderer)
  })

  it('maps denied/cancel/missing/timeout failures and always resumes', async () => {
    const dir = await makeTempDir()
    const path = join(dir, 'mongod.log')

    const cases: Array<{
      name: string
      spawn: ElevatedSpawn
      kind: 'denied' | 'cancelled' | 'sudo_missing' | 'timeout'
      message: string
      timeoutMs?: number
      expectKill?: boolean
    }> = [
      {
        name: 'denied',
        kind: 'denied',
        message: 'Incorrect password or sudo denied.',
        spawn: mockSpawnFrom(() => ({
          stdout: new Response('').body,
          exited: Promise.resolve(1),
          kill: () => true,
          signalCode: null,
        })),
      },
      {
        name: 'cancelled',
        kind: 'cancelled',
        message: 'Elevated access cancelled.',
        spawn: mockSpawnFrom(() => ({
          stdout: new Response('').body,
          exited: Promise.resolve(130),
          kill: () => true,
          signalCode: 'SIGINT',
        })),
      },
      {
        name: 'sudo_missing',
        kind: 'sudo_missing',
        message: 'sudo is not available on this system.',
        spawn: () => {
          throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        },
      },
      {
        name: 'timeout',
        kind: 'timeout',
        message: 'Timed out waiting for sudo. Try again.',
        timeoutMs: 20,
        expectKill: true,
        spawn: (() => {
          let resolveExited: ((code: number) => void) | null = null
          const killFn = vi.fn((_signal?: number | NodeJS.Signals) => {
            resolveExited?.(137)
            return true
          })
          const spawnFn = mockSpawnFrom(() => ({
            stdout: new Response('').body,
            exited: new Promise<number>((resolve) => {
              resolveExited = resolve
            }),
            kill: killFn,
            signalCode: null,
          }))
          ;(spawnFn as ElevatedSpawn & { killFn: typeof killFn }).killFn = killFn
          return spawnFn
        })(),
      },
    ]

    for (const testCase of cases) {
      clearSessionElevatedDirectories()
      const renderer = createMockRenderer()
      const result = await materializeLogFileTailElevated({
        renderer,
        path,
        timeoutMs: testCase.timeoutMs,
        spawn: testCase.spawn,
      })
      expect(result, testCase.name).toEqual({
        ok: false,
        kind: testCase.kind,
        message: testCase.message,
      })
      if (testCase.expectKill) {
        const killFn = (testCase.spawn as ElevatedSpawn & { killFn?: ReturnType<typeof vi.fn> })
          .killFn
        expect(killFn, testCase.name).toHaveBeenCalledWith('SIGKILL')
      }
      expectResumeAfterSuspend(renderer)
    }
  })

  it('rejects relative and .. file paths before spawn', async () => {
    const renderer = createMockRenderer()
    const spawn = vi.fn()
    await expect(
      materializeLogFileTailElevated({
        renderer,
        path: 'mongod.log',
        spawn: spawn as unknown as ElevatedSpawn,
      }),
    ).resolves.toMatchObject({ ok: false, kind: 'invalid_path' })
    await expect(
      materializeLogFileTailElevated({
        renderer,
        path: '/var/log/../mongodb/mongod.log',
        spawn: spawn as unknown as ElevatedSpawn,
      }),
    ).resolves.toMatchObject({ ok: false, kind: 'invalid_path' })
    expect(spawn).not.toHaveBeenCalled()
    expectResumeAfterSuspend(renderer, { suspended: false })
  })
})
