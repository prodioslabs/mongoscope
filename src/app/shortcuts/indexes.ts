import { type FooterChip, type Shortcut, toFooter } from './types'

/**
 * Indexes tab navigation + help. Connection open is owned by DbSelector
 * (`CONNECTIONS_TAB_SHORTCUTS`).
 */
export const INDEXES_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: '←/→',
    helpLabel: 'Switch database',
    footerLabel: 'database',
    footerKeys: '←→',
    bindings: [
      { key: 'left', cmd: 'indexes.prev-database' },
      { key: 'right', cmd: 'indexes.next-database' },
    ],
  },
  {
    keys: '↑/↓ / j/k',
    helpLabel: 'Navigate collections',
    footerLabel: 'collection',
    footerKeys: '↑↓/jk',
    bindings: [
      { key: 'up', cmd: 'indexes.prev-collection' },
      { key: 'k', cmd: 'indexes.prev-collection' },
      { key: 'down', cmd: 'indexes.next-collection' },
      { key: 'j', cmd: 'indexes.next-collection' },
    ],
  },
  {
    keys: 'c',
    helpLabel: 'Select or manage the MongoDB connection',
    footerLabel: 'connections',
    bindings: [],
  },
  {
    keys: '5s',
    helpLabel: 'Index inventory auto-refresh while this tab is open',
    bindings: [],
  },
  {
    keys: 'node',
    helpLabel: '$indexStats ops/since are from the connected node only',
    bindings: [],
  },
]

export const INDEXES_FOOTER: FooterChip[] = toFooter([
  INDEXES_SHORTCUTS[0]!,
  INDEXES_SHORTCUTS[1]!,
])
