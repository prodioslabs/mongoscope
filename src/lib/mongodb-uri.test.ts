import { describe, expect, it } from 'vitest'
import { buildMongoDbUri, hostLabelFromUri, resolveCliMongoUri } from './mongodb-uri'

describe('hostLabelFromUri', () => {
  it('extracts host and port from mongodb:// URIs', () => {
    expect(hostLabelFromUri('mongodb://user:s3cret@db.example:27017/app')).toBe('db.example:27017')
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

describe('buildMongoDbUri', () => {
  it('builds a URI with default port 27017', () => {
    expect(buildMongoDbUri({ host: 'localhost' })).toBe('mongodb://localhost:27017/')
  })

  it('includes credentials and authSource', () => {
    expect(
      buildMongoDbUri({
        host: 'db.example',
        port: 27018,
        username: 'user',
        password: 'p@ss',
        authDb: 'admin',
      }),
    ).toBe('mongodb://user:p%40ss@db.example:27018/?authSource=admin')
  })

  it('rejects empty host and password without username', () => {
    expect(() => buildMongoDbUri({ host: '  ' })).toThrow(/host/)
    expect(() => buildMongoDbUri({ host: 'localhost', password: 'x' })).toThrow(/username/)
  })
})

describe('resolveCliMongoUri', () => {
  it('returns null when no live flags are set', () => {
    expect(resolveCliMongoUri({})).toBeNull()
  })

  it('returns trimmed --uri after validation', () => {
    expect(resolveCliMongoUri({ uri: '  mongodb://localhost:27017  ' })).toBe(
      'mongodb://localhost:27017',
    )
  })

  it('builds from discrete flags', () => {
    expect(resolveCliMongoUri({ host: 'db.example', port: 27018 })).toBe(
      'mongodb://db.example:27018/',
    )
  })

  it('rejects --uri combined with discrete flags', () => {
    expect(() => resolveCliMongoUri({ uri: 'mongodb://localhost:27017', host: 'x' })).toThrow(
      /either --uri or --host/,
    )
  })

  it('rejects discrete flags without --host', () => {
    expect(() => resolveCliMongoUri({ port: 27017 })).toThrow(/--host is required/)
  })
})
