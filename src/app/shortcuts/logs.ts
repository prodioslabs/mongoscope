import { type FooterChip, type Shortcut, toFooter } from './types'

export const LOGS_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: '↑/↓ / j/k',
    helpLabel: 'Navigate rows',
    footerLabel: 'navigate',
    footerKeys: '↑↓/jk',
    bindings: [
      { key: 'up', cmd: 'logs.move-up' },
      { key: 'k', cmd: 'logs.move-up' },
      { key: 'down', cmd: 'logs.move-down' },
      { key: 'j', cmd: 'logs.move-down' },
    ],
  },
  {
    keys: 'space',
    helpLabel: 'Toggle follow (pin to newest lines — file tail or getLog)',
    footerLabel: 'follow',
    bindings: [{ key: 'space', cmd: 'logs.toggle-follow' }],
  },
  {
    keys: '/',
    helpLabel: 'Search msg and namespace',
    footerLabel: 'search',
    bindings: [{ key: '/', cmd: 'logs.open-search' }],
  },
  {
    keys: 'f',
    helpLabel: 'Edit custom filter expression',
    footerLabel: 'filter',
    bindings: [{ key: 'f', cmd: 'logs.open-filter' }],
  },
  {
    keys: 'c/w/r/n/s',
    helpLabel: 'Toggle COMMAND / WRITE / REPL / NETWORK / STORAGE pills',
    helpSegments: [
      { key: '', text: 'Toggle ' },
      { key: 'c', text: 'COMMAND' },
      { key: '', text: ' / ' },
      { key: 'w', text: 'WRITE' },
      { key: '', text: ' / ' },
      { key: 'r', text: 'REPL' },
      { key: '', text: ' / ' },
      { key: 'n', text: 'NETWORK' },
      { key: '', text: ' / ' },
      { key: 's', text: 'STORAGE' },
      { key: '', text: ' pills' },
    ],
    bindings: [
      { key: 'c', cmd: 'logs.toggle-COMMAND' },
      { key: 'w', cmd: 'logs.toggle-WRITE' },
      { key: 'r', cmd: 'logs.toggle-REPL' },
      { key: 'n', cmd: 'logs.toggle-NETWORK' },
      { key: 's', cmd: 'logs.toggle-STORAGE' },
    ],
  },
  {
    keys: 'l',
    helpLabel:
      'Toggle Static file / Live getLog (when a connection is selected; getLog is a ~1024-event RAM buffer)',
    footerLabel: 'source',
    // Bound in LogsTab source layer (priority), not LogsView.
    bindings: [],
  },
]

export const LOGS_FOOTER: FooterChip[] = [
  ...toFooter([LOGS_SHORTCUTS[0]!, LOGS_SHORTCUTS[1]!, LOGS_SHORTCUTS[2]!, LOGS_SHORTCUTS[3]!]),
]
