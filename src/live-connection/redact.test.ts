import { describe, expect, it } from 'vitest'
import { redactConnectionSecrets } from './redact'

describe('redactConnectionSecrets', () => {
  it('redacts mongodb and mongodb+srv URIs including credentials', () => {
    const input =
      'failed to connect to mongodb://admin:s3cret@cluster.example.com:27017/db?authSource=admin'
    const output = redactConnectionSecrets(input)
    expect(output).toContain('[redacted-uri]')
    expect(output).not.toContain('s3cret')
    expect(output).not.toContain('mongodb://')
  })

  it('redacts userinfo@host even without a mongodb scheme', () => {
    const input = 'SCRAM failure for admin:hunter2@db.internal:27017'
    const output = redactConnectionSecrets(input)
    expect(output).not.toContain('hunter2')
    expect(output).toContain('[redacted-credentials]@[redacted-host]')
  })

  it('leaves messages without credentials unchanged', () => {
    expect(redactConnectionSecrets('Server selection timed out after 8000 ms')).toBe(
      'Server selection timed out after 8000 ms',
    )
  })
})
