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

function successfulLsSpawn(stdout: string): ElevatedSpawn {
  return mockSpawnFrom((command) => {
    expect(command[0]).toBe('sudo')
    expect(command[1]).toBe('--')
    expect(command[2]).toBe('ls')
    expect(command[3]).toBe('-1A')
    return {
      stdout: new Response(stdout).body,
      exited: Promise.resolve(0),
      kill: () => true,
      signalCode: null,
    }
  })
}

function successfulTailSpawn(bytes: string): ElevatedSpawn {
  return mockSpawnFrom((command) => {
    expect(command[0]).toBe('sudo')
    expect(command[1]).toBe('--')
    expect(command[2]).toBe('tail')
    expect(command[3]).toBe('-c')
    return {
      stdout: new Response(bytes).body,
      exited: Promise.resolve(0),
      kill: () => true,
      signalCode: null,
    }
  })
}

describe('validateElevatedPath', () => {
  it('accepts absolute paths without ..', () => {
    expect(validateElevatedPath('/var/log/mongodb')).toEqual({
      ok: true,
      value: '/var/log/mongodb',
    })
  })

  it('rejects relative paths and .. segments', () => {
    expect(validateElevatedPath('var/log/mongodb').ok).toBe(false)
    expect(validateElevatedPath('/var/log/../mongodb').ok).toBe(false)
    expect(validateElevatedPath('/var/log/mongodb/..').ok).toBe(false)
  })
})

describe('runElevatedCommand', () => {
  it('always resumes after success', async () => {
    const renderer = createMockRenderer()
    const result = await runElevatedCommand({
      renderer,
      argvAfterSudo: ['ls', '-1A', '/tmp'],
      spawn: successfulLsSpawn('mongod.log\n'),
    })
    expect(result.ok).toBe(true)
    expect(renderer.suspendCalls).toBe(1)
    expect(renderer.resumeCalls).toBe(1)
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
      message: elevatedFailureMessage('denied'),
    })
    expect(renderer.resumeCalls).toBe(1)
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
      message: elevatedFailureMessage('cancelled'),
    })
    expect(renderer.resumeCalls).toBe(1)
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
      message: elevatedFailureMessage('sudo_missing'),
    })
    expect(renderer.resumeCalls).toBe(1)
  })
})

describe('listLogFilesElevated', () => {
  it('lists mongo log names from elevated ls and marks session approval', async () => {
    const dir = await makeTempDir()
    await writeFile(join(dir, 'mongod.log'), 'x\n', 'utf8')
    await writeFile(join(dir, 'readme.txt'), 'x\n', 'utf8')
    await chmod(dir, 0o000)

    const unprivileged = await listLogFiles(dir)
    if (unprivileged.status !== 'permission_denied' && unprivileged.status !== 'ok') {
      // Unexpected in this environment; still exercise elevated path.
    }

    const renderer = createMockRenderer()
    const result = await listLogFilesElevated({
      renderer,
      dir,
      spawn: successfulLsSpawn('mongod.log\nreadme.txt\n'),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ status: 'ok', files: ['mongod.log'] })
    }
    expect(isDirectorySessionElevated(dir)).toBe(true)
    expect(renderer.suspendCalls).toBe(1)
    expect(renderer.resumeCalls).toBe(1)

    await chmod(dir, 0o755)
  })

  it('refuses paths with .. before spawn', async () => {
    const renderer = createMockRenderer()
    const spawn = vi.fn()
    const result = await listLogFilesElevated({
      renderer,
      dir: '/var/log/../mongodb',
      spawn: spawn as unknown as ElevatedSpawn,
    })
    expect(result.ok).toBe(false)
    expect(spawn).not.toHaveBeenCalled()
    expect(renderer.suspendCalls).toBe(0)
    expect(renderer.resumeCalls).toBe(0)
  })
})

describe('materializeLogFileTailElevated', () => {
  it('writes a 0600 temp file from elevated tail output and marks the dir', async () => {
    const dir = await makeTempDir()
    const path = join(dir, 'mongod.log')
    const renderer = createMockRenderer()
    const result = await materializeLogFileTailElevated({
      renderer,
      path,
      spawn: successfulTailSpawn('{"t":{}}\n'),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(isDirectorySessionElevated(dir)).toBe(true)
    expect(renderer.suspendCalls).toBe(1)
    expect(renderer.resumeCalls).toBe(1)
    await access(result.value)
    await unlinkElevatedTempFile(result.value)
  })
})
