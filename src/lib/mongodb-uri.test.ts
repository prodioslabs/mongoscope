import { describe, expect, it } from 'vitest'
import { hostLabelFromUri } from './mongodb-uri'

describe('hostLabelFromUri', () => {
  it('extracts host and port from mongodb:// URIs', () => {
    expect(hostLabelFromUri('mongodb://user:s3cret@db.example:27017/app')).toBe(
      'db.example:27017',
    )
  })

  it('omits default-less port for mongodb+srv', () => {
    expect(hostLabelFromUri('mongodb+srv://user:s3cret@cluster0.example.net/app')).toBe(
      'cluster0.example.net',
    )
  })

  it('rejects invalid URIs without echoing credentials', () => {
    expect(() => hostLabelFromUri('not-a-uri')).toThrow('Invalid MongoDB connection URI')
  })
})
