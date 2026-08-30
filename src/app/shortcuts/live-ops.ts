import { type FooterChip, type Shortcut, toFooter } from './types'

export const LIVE_OPS_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: '↑/↓ / j/k',
    helpLabel: 'Navigate rows',
    footerLabel: 'navigate',
    footerKeys: '↑↓/jk',
    bindings: [
      { key: 'up', cmd: 'live-ops.move-up' },
      { key: 'k', cmd: 'live-ops.move-up' },
      { key: 'down', cmd: 'live-ops.move-down' },
      { key: 'j', cmd: 'live-ops.move-down' },
    ],
  },
  {
    keys: 'x',
    helpLabel: 'Kill selected operation (confirm)',
    footerLabel: 'kill',
    bindings: [{ key: 'x', cmd: 'live-ops.kill-open' }],
  },
  {
    keys: 'e',
    helpLabel: 'Jump to explain on Slow Queries tab',
    footerLabel: 'explain',
    bindings: [{ key: 'e', cmd: 'live-ops.jump-explain' }],
  },
]

export const LIVE_OPS_FOOTER: FooterChip[] = [
  ...toFooter([LIVE_OPS_SHORTCUTS[0]!]),
  { keys: 'x', label: 'kill' },
  { keys: 'e', label: 'explain' },
]

export const LIVE_OPS_KILL_CONFIRM_FOOTER: FooterChip[] = [
  { keys: 'enter', label: 'confirm' },
  { keys: 'esc', label: 'cancel' },
]
