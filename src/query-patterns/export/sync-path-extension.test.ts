import { describe, expect, it } from 'vitest'
import { syncPathExtension } from './sync-path-extension'

describe('syncPathExtension', () => {
  it('swaps the extension on an untouched default path', () => {
    expect(syncPathExtension('mongoscope-slow-queries-20261008-120000.json', 'csv', false)).toBe(
      'mongoscope-slow-queries-20261008-120000.csv',
    )
    expect(syncPathExtension('mongoscope-slow-queries-20261008-120000.csv', 'markdown', false)).toBe(
      'mongoscope-slow-queries-20261008-120000.md',
    )
  })

  it('leaves an edited path alone', () => {
    expect(syncPathExtension('/tmp/my-export.json', 'csv', true)).toBe('/tmp/my-export.json')
    expect(syncPathExtension('report', 'json', true)).toBe('report')
  })

  it('appends an extension when the untouched path has none', () => {
    expect(syncPathExtension('mongoscope-slow-queries-20261008-120000', 'json', false)).toBe(
      'mongoscope-slow-queries-20261008-120000.json',
    )
  })

  it('replaces only the final extension when the basename has multiple dots', () => {
    expect(syncPathExtension('out.backup.json', 'csv', false)).toBe('out.backup.csv')
    expect(syncPathExtension('/home/me/my.report.final.md', 'json', false)).toBe(
      '/home/me/my.report.final.json',
    )
  })
})
