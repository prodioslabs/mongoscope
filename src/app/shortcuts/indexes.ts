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
    keys: '[ / ]',
    helpLabel: 'Switch collection',
    footerLabel: 'collection',
    footerKeys: '[]',
    bindings: [
      { key: '[', cmd: 'indexes.prev-collection' },
      { key: ']', cmd: 'indexes.next-collection' },
    ],
  },
  {
    keys: '↑/↓ / j/k',
    helpLabel: 'Navigate index rows',
    footerLabel: 'navigate',
    footerKeys: '↑↓/jk',
    bindings: [
      { key: 'up', cmd: 'indexes.move-up' },
      { key: 'k', cmd: 'indexes.move-up' },
      { key: 'down', cmd: 'indexes.move-down' },
      { key: 'j', cmd: 'indexes.move-down' },
    ],
  },
  {
    keys: 'n',
    helpLabel: 'Sort collections by name (toggle direction)',
    footerLabel: 'sort name',
    bindings: [{ key: 'n', cmd: 'indexes.sort-collection-name' }],
  },
  {
    keys: 'i',
    helpLabel: 'Sort collections by index count (toggle direction)',
    footerLabel: 'sort idx',
    bindings: [{ key: 'i', cmd: 'indexes.sort-collection-indexes' }],
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

export const INDEXES_FOOTER: FooterChip[] = [
  ...toFooter([
    INDEXES_SHORTCUTS[0]!,
    INDEXES_SHORTCUTS[1]!,
    INDEXES_SHORTCUTS[2]!,
  ]),
  { keys: 'n/i', label: 'sort name/idx' },
]
