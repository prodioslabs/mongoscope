import { type AppKeymapMode } from './keymap-mode'

export type OverlayModeKeymap = {
  setData(key: 'app.mode', value: AppKeymapMode): void
}

let nextOwnerId = 0

export function createOverlayOwnerId(prefix: string): string {
  nextOwnerId += 1
  return `${prefix}-${nextOwnerId}`
}

export function createOverlayMode() {
  const holds = new Map<string, number>()

  function sync(keymap: OverlayModeKeymap) {
    keymap.setData('app.mode', holds.size > 0 ? 'palette' : 'base')
  }

  return {
    acquire(id: string, keymap: OverlayModeKeymap) {
      holds.set(id, (holds.get(id) ?? 0) + 1)
      sync(keymap)
    },
    release(id: string, keymap: OverlayModeKeymap) {
      const remaining = (holds.get(id) ?? 0) - 1
      if (remaining <= 0) {
        holds.delete(id)
      } else {
        holds.set(id, remaining)
      }
      sync(keymap)
    },
    /** Drop every hold and force base mode (e.g. after HMR removed an overlay owner). */
    clear(keymap: OverlayModeKeymap) {
      holds.clear()
      sync(keymap)
    },
  }
}

/** Shared stack for dialogs and full-screen palette-mode screens. */
export const overlayMode = createOverlayMode()
