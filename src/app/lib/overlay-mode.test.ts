import { describe, expect, it } from 'vitest'
import { createOverlayMode, type OverlayModeKeymap } from './overlay-mode'

function createMockKeymap(initial: 'base' | 'palette' = 'base'): OverlayModeKeymap & {
  mode: 'base' | 'palette'
} {
  const keymap = {
    mode: initial,
    setData(key: 'app.mode', value: 'base' | 'palette') {
      if (key === 'app.mode') {
        keymap.mode = value
      }
    },
  }
  return keymap
}

describe('overlayMode', () => {
  it('sets palette while any overlay is held and restores base when the last one releases', () => {
    const mode = createOverlayMode()
    const keymap = createMockKeymap()

    mode.acquire('query-detail', keymap)
    expect(keymap.mode).toBe('palette')

    mode.acquire('command-palette', keymap)
    expect(keymap.mode).toBe('palette')

    mode.release('command-palette', keymap)
    expect(keymap.mode).toBe('palette')

    mode.release('query-detail', keymap)
    expect(keymap.mode).toBe('base')
  })

  it('keeps palette mode when a full-screen overlay outlives a dialog', () => {
    const mode = createOverlayMode()
    const keymap = createMockKeymap()

    mode.acquire('connection-add', keymap)
    mode.acquire('command-palette', keymap)
    mode.release('command-palette', keymap)

    expect(keymap.mode).toBe('palette')

    mode.release('connection-add', keymap)
    expect(keymap.mode).toBe('base')
  })

  it('keeps a hold if the same overlay is acquired twice and released once', () => {
    const mode = createOverlayMode()
    const keymap = createMockKeymap()

    mode.acquire('query-detail', keymap)
    mode.acquire('query-detail', keymap)
    mode.release('query-detail', keymap)

    expect(keymap.mode).toBe('palette')

    mode.release('query-detail', keymap)
    expect(keymap.mode).toBe('base')
  })
})
