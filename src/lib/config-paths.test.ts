import { describe, expect, it } from 'vitest'
import { appConfigFilePath, resolveConfigDir, userThemesDir } from './config-paths'

describe('config-paths', () => {
  it('uses XDG_CONFIG_HOME when set', () => {
    const env = { XDG_CONFIG_HOME: '/tmp/xdg-config' }
    expect(resolveConfigDir(env, '/home/someone')).toBe('/tmp/xdg-config/mongoscope')
    expect(appConfigFilePath(env, '/home/someone')).toBe('/tmp/xdg-config/mongoscope/config.json')
    expect(userThemesDir(env, '/home/someone')).toBe('/tmp/xdg-config/mongoscope/themes')
  })

  it('falls back to ~/.config/mongoscope when XDG_CONFIG_HOME is unset', () => {
    const env = {}
    expect(resolveConfigDir(env, '/home/someone')).toBe('/home/someone/.config/mongoscope')
    expect(appConfigFilePath(env, '/home/someone')).toBe(
      '/home/someone/.config/mongoscope/config.json',
    )
    expect(userThemesDir(env, '/home/someone')).toBe('/home/someone/.config/mongoscope/themes')
  })

  it('treats blank XDG_CONFIG_HOME as unset', () => {
    const env = { XDG_CONFIG_HOME: '   ' }
    expect(resolveConfigDir(env, '/home/someone')).toBe('/home/someone/.config/mongoscope')
  })
})
