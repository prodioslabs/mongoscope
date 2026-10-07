import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CONNECTIONS_SECRET_NAME, SECRET_SERVICE } from './secret-store'
import { createPlaintextSecretBackend } from './plaintext-secret-backend'

const tempRoots: string[] = []

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

async function makeTempConfigPath(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'mongoscope-plaintext-secrets-'))
  tempRoots.push(root)
  return join(root, 'config.json')
}

describe('createPlaintextSecretBackend', () => {
  it('round-trips get/set/delete under secrets[service][name]', async () => {
    const path = await makeTempConfigPath()
    const backend = createPlaintextSecretBackend(path)

    await expect(
      backend.get({ service: SECRET_SERVICE, name: CONNECTIONS_SECRET_NAME }),
    ).resolves.toBeNull()

    await backend.set({
      service: SECRET_SERVICE,
      name: CONNECTIONS_SECRET_NAME,
      value: '{"version":1,"connections":[]}',
    })

    await expect(
      backend.get({ service: SECRET_SERVICE, name: CONNECTIONS_SECRET_NAME }),
    ).resolves.toBe('{"version":1,"connections":[]}')

    const written = JSON.parse(await readFile(path, 'utf8'))
    expect(written.secrets).toEqual({
      [SECRET_SERVICE]: {
        [CONNECTIONS_SECRET_NAME]: '{"version":1,"connections":[]}',
      },
    })

    await expect(
      backend.delete({ service: SECRET_SERVICE, name: CONNECTIONS_SECRET_NAME }),
    ).resolves.toBe(true)
    await expect(
      backend.get({ service: SECRET_SERVICE, name: CONNECTIONS_SECRET_NAME }),
    ).resolves.toBeNull()
    await expect(
      backend.delete({ service: SECRET_SERVICE, name: CONNECTIONS_SECRET_NAME }),
    ).resolves.toBe(false)

    const afterDelete = JSON.parse(await readFile(path, 'utf8'))
    expect(afterDelete.secrets).toBeUndefined()
  })

  it('preserves theme keys when writing a secret', async () => {
    const path = await makeTempConfigPath()
    await writeFile(
      path,
      JSON.stringify({ version: 1, theme: 'nord', mode: 'light' }, null, 2),
      'utf8',
    )
    const backend = createPlaintextSecretBackend(path)

    await backend.set({
      service: SECRET_SERVICE,
      name: CONNECTIONS_SECRET_NAME,
      value: 'blob',
    })

    const written = JSON.parse(await readFile(path, 'utf8'))
    expect(written).toEqual({
      version: 1,
      theme: 'nord',
      mode: 'light',
      secrets: {
        [SECRET_SERVICE]: {
          [CONNECTIONS_SECRET_NAME]: 'blob',
        },
      },
    })
  })
})
