import { type FooterChip, type Shortcut } from './types'

export const WELCOME_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: '↑/↓ / j/k',
    helpLabel: 'Navigate log files',
    footerLabel: 'navigate',
    footerKeys: '↑↓/jk',
    bindings: [
      { key: 'up', cmd: 'welcome.move-up' },
      { key: 'k', cmd: 'welcome.move-up' },
      { key: 'down', cmd: 'welcome.move-down' },
      { key: 'j', cmd: 'welcome.move-down' },
    ],
  },
  {
    keys: 'tab',
    helpLabel: 'Switch section',
    footerLabel: 'section',
    bindings: [{ key: 'tab', cmd: 'welcome.toggle-section' }],
  },
  {
    keys: 'enter',
    helpLabel: 'Analyze selected log',
    footerLabel: 'analyze',
    bindings: [
      { key: 'return', cmd: 'welcome.analyze' },
      { key: 'enter', cmd: 'welcome.analyze' },
    ],
  },
  {
    keys: 'r',
    helpLabel:
      'Retry with sudo when a log directory or selected file is permission-denied (confirm first)',
    footerLabel: 'sudo',
    bindings: [{ key: 'r', cmd: 'welcome.retry-sudo' }],
  },
]

export const WELCOME_PARSING_FOOTER: FooterChip[] = [{ keys: '…', label: 'parsing' }]

export const WELCOME_ELEVATED_CONFIRM_FOOTER: FooterChip[] = [
  { keys: 'enter', label: 'confirm' },
  { keys: 'esc', label: 'cancel' },
]

export const WELCOME_PERMISSION_FOOTER: FooterChip[] = [
  { keys: 'r', label: 'sudo' },
  { keys: 'tab', label: 'section' },
]
