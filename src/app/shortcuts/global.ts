import { type Shortcut } from './types'

/** Always-on / base app shortcuts (palette + help stay active in overlays). */
export const GLOBAL_ALWAYS_ON_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: 'ctrl+k',
    helpLabel: 'Open command palette',
    footerLabel: 'commands',
    bindings: [{ key: 'ctrl+k', cmd: 'app.toggle-palette' }],
  },
  {
    keys: '?',
    helpLabel: 'Show this help',
    footerLabel: 'help',
    bindings: [{ key: '?', cmd: 'app.toggle-help' }],
  },
]

/** Base-mode only (disabled while palette/help overlay is open). */
export const GLOBAL_BASE_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: 'q',
    helpLabel: 'Quit',
    footerLabel: 'quit',
    bindings: [{ key: 'q', cmd: 'app.quit' }],
  },
  {
    keys: 'm',
    helpLabel: 'Toggle light/dark mode (session only; not saved to config)',
    bindings: [{ key: 'm', cmd: 'app.toggle-mode' }],
  },
  {
    keys: 't',
    helpLabel: 'Cycle theme (persisted to ~/.config/mongoscope/config.json)',
    bindings: [{ key: 't', cmd: 'app.cycle-theme' }],
  },
]

export const GLOBAL_SHORTCUTS: readonly Shortcut[] = [
  ...GLOBAL_ALWAYS_ON_SHORTCUTS,
  ...GLOBAL_BASE_SHORTCUTS,
]

/** Default footer chips appended after screen-scoped bindings. */
export const GLOBAL_FOOTER_SHORTCUTS: readonly Shortcut[] = [
  GLOBAL_ALWAYS_ON_SHORTCUTS[0]!,
  GLOBAL_ALWAYS_ON_SHORTCUTS[1]!,
  GLOBAL_BASE_SHORTCUTS[0]!,
]
