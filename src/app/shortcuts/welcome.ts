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
]

export const WELCOME_PARSING_FOOTER: FooterChip[] = [{ keys: '…', label: 'parsing' }]
