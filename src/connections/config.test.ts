import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  connectionsFilePath,
  emptyConnectionsFile,
  loadConnections,
  resolveConfigDir,
  saveConnections,
  validateConnectionsFile,
} from './config'
import type { ConnectionsFile } from './types'

const temporaryDirectories: string[] = []

afterEach(async function cleanupTemporaryDirectories() {
  while (temporaryDirectories.length > 0) {
    const directoryPath = temporaryDirectories.pop()
    if (directoryPath) {
      await rm(directoryPath, { recursive: true, force: true })
    }
  }
})

async function makeTemporaryDirectory(): Promise<string> {
  const directoryPath = await mkdtemp(join(tmpdir(), 'mongoscope-conn-cfg-'))
  temporaryDirectories.push(directoryPath)
  return directoryPath
}

describe('resolveConfigDir', () => {
  it('uses XDG_CONFIG_HOME when set', () => {
    expect(resolveConfigDir({ XDG_CONFIG_HOME: '/custom/xdg' }, '/home/me')).toBe(
      '/custom/xdg/mongoscope',
    )
  })

  it('falls back to ~/.config/mongoscope', () => {
    expect(resolveConfigDir({}, '/home/me')).toBe('/home/me/.config/mongoscope')
  })
})

describe('connectionsFilePath', () => {
  it('appends connections.json under the config dir', () => {
    expect(connectionsFilePath({ XDG_CONFIG_HOME: '/custom/xdg' }, '/home/me')).toBe(
      '/custom/xdg/mongoscope/connections.json',
    )
  })
})

describe('loadConnections / saveConnections', () => {
  it('returns an empty file when missing', async () => {
    const directoryPath = await makeTemporaryDirectory()
    const filePath = join(directoryPath, 'connections.json')
    await expect(loadConnections(filePath)).resolves.toEqual(emptyConnectionsFile())
  })

  it('round-trips a connections file with the expected shape', async () => {
    const directoryPath = await makeTemporaryDirectory()
    const filePath = join(directoryPath, 'mongoscope', 'connections.json')

    const file: ConnectionsFile = {
      version: 1,
      connections: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'local',
          hostLabel: 'localhost:27017',
          tags: ['dev'],
          createdAt: '2026-08-11T00:00:00.000Z',
        },
      ],
    }

    await saveConnections(file, filePath)

    const fileContents = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(fileContents) as ConnectionsFile
    expect(parsed).toEqual(file)

    const loaded = await loadConnections(filePath)
    expect(loaded).toEqual(file)
  })

  it('rejects invalid JSON on load', async () => {
    const directoryPath = await makeTemporaryDirectory()
    const filePath = join(directoryPath, 'connections.json')
    await writeFile(filePath, '{not-json')
    await expect(loadConnections(filePath)).rejects.toThrow(/not valid JSON/)
  })

  it('rejects unsupported version', () => {
    expect(() => validateConnectionsFile({ version: 2, connections: [] })).toThrow(
      /unsupported version/,
    )
  })
})
