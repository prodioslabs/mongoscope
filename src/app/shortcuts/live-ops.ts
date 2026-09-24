import { type FooterChip, type Shortcut, toFooter } from './types'

export const LIVE_OPS_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: '↑/↓ / j/k',
    helpLabel: 'Navigate currentOp rows (COLLSCAN plans highlighted)',
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
    helpLabel: 'Kill selected operation (confirm dialog)',
    footerLabel: 'kill',
    bindings: [{ key: 'x', cmd: 'live-ops.kill-open' }],
  },
  {
    keys: 'e',
    helpLabel: 'Jump to matching Slow Queries detail / explain when a pattern matches',
    footerLabel: 'explain',
    bindings: [{ key: 'e', cmd: 'live-ops.jump-explain' }],
  },
  {
    keys: '1s',
    helpLabel: 'currentOp + collection top + sidebar auto-refresh while this tab is open',
    bindings: [],
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
