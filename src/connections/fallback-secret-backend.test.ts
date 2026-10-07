import { describe, expect, it } from 'vitest'
import { createFallbackSecretBackend, type SecretBackend } from './secret-store'

function createTrackingBackend(label: string): SecretBackend & {
  calls: string[]
  failWith?: Error
} {
  const backend = {
    calls: [] as string[],
    failWith: undefined as Error | undefined,
    async get({ name }: { service: string; name: string }) {
      backend.calls.push(`${label}:get:${name}`)
      if (backend.failWith) {
        throw backend.failWith
      }
      return `${label}-value`
    },
    async set({ name }: { service: string; name: string; value: string }) {
      backend.calls.push(`${label}:set:${name}`)
      if (backend.failWith) {
        throw backend.failWith
      }
    },
    async delete({ name }: { service: string; name: string }) {
      backend.calls.push(`${label}:delete:${name}`)
      if (backend.failWith) {
        throw backend.failWith
      }
      return true
    },
  }
  return backend
}

describe('createFallbackSecretBackend', () => {
  it('uses the fallback immediately when primary is null', async () => {
    const fallback = createTrackingBackend('file')
    const backend = createFallbackSecretBackend(null, fallback)

    await expect(backend.get({ service: 'svc', name: 'n' })).resolves.toBe('file-value')
    expect(fallback.calls).toEqual(['file:get:n'])
  })

  it('retries on the fallback after an unavailable primary error', async () => {
    const primary = createTrackingBackend('bun')
    primary.failWith = new Error('libsecret: secret service not available')
    const fallback = createTrackingBackend('file')
    const backend = createFallbackSecretBackend(primary, fallback)

    await expect(backend.set({ service: 'svc', name: 'n', value: 'x' })).resolves.toBeUndefined()
    expect(primary.calls).toEqual(['bun:set:n'])
    expect(fallback.calls).toEqual(['file:set:n'])

    // Subsequent calls stay on the fallback without hitting primary again.
    primary.failWith = undefined
    await expect(backend.get({ service: 'svc', name: 'n' })).resolves.toBe('file-value')
    expect(primary.calls).toEqual(['bun:set:n'])
    expect(fallback.calls).toEqual(['file:set:n', 'file:get:n'])
  })

  it('does not fall back on a denied primary error', async () => {
    const primary = createTrackingBackend('bun')
    primary.failWith = new Error('user canceled keychain access')
    const fallback = createTrackingBackend('file')
    const backend = createFallbackSecretBackend(primary, fallback)

    await expect(backend.get({ service: 'svc', name: 'n' })).rejects.toThrow(/canceled|keychain/i)
    expect(fallback.calls).toEqual([])
  })
})
