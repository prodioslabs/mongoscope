import { describe, expect, it } from 'vitest'
import { expandHomePath, resolveUserPath } from './expand-home-path'

describe('expandHomePath', () => {
  it('expands ~ and ~/…', () => {
    expect(expandHomePath('~', '/home/me')).toBe('/home/me')
    expect(expandHomePath('~/exports/out.json', '/home/me')).toBe('/home/me/exports/out.json')
  })

  it('trims and leaves other paths unchanged', () => {
    expect(expandHomePath('  /tmp/a.json  ', '/home/me')).toBe('/tmp/a.json')
    expect(expandHomePath('rel/out.json', '/home/me')).toBe('rel/out.json')
  })
})

describe('resolveUserPath', () => {
  it('resolves relative paths against cwd after expanding ~', () => {
    expect(resolveUserPath('out.json', '/work', '/home/me')).toBe('/work/out.json')
    expect(resolveUserPath('~/out.json', '/work', '/home/me')).toBe('/home/me/out.json')
  })
})
