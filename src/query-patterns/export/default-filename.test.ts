import { describe, expect, it } from 'vitest'
import { defaultExportFilename } from './default-filename'

describe('defaultExportFilename', () => {
  it('uses local wall-clock time and the format extension', () => {
    const local = new Date(2026, 9, 8, 16, 5, 9)
    expect(defaultExportFilename('json', local)).toBe('mongoscope-slow-queries-20261008-160509.json')
    expect(defaultExportFilename('csv', local)).toBe('mongoscope-slow-queries-20261008-160509.csv')
    expect(defaultExportFilename('markdown', local)).toBe(
      'mongoscope-slow-queries-20261008-160509.md',
    )
  })
})
