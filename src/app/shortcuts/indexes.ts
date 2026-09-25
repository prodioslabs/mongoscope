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
    bindings: [{ key: 'n', cmd: 'indexes.sort-collection-name' }],
  },
  {
    keys: 'i',
    helpLabel: 'Sort collections by index count (toggle direction)',
    bindings: [{ key: 'i', cmd: 'indexes.sort-collection-indexes' }],
  },
  {
    keys: 's',
    helpLabel: 'Sort indexes by size (toggle direction)',
    bindings: [{ key: 's', cmd: 'indexes.sort-size' }],
  },
  {
    keys: 'o',
    helpLabel: 'Sort indexes by ops (toggle direction)',
    bindings: [{ key: 'o', cmd: 'indexes.sort-ops' }],
  },
  {
    keys: 'c',
    helpLabel: 'Select or manage the MongoDB connection (DbSelector)',
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
  {
    keys: 'build',
    helpLabel: 'BUILD % from $currentOp on the connected node (idleConnections included)',
    bindings: [],
  },
  {
    keys: 'i (in SQ)',
    helpLabel:
      'From Slow Queries details (enter → i): jump here with suggested vs existing index (read-only — create outside MongoScope)',
    bindings: [],
  },
]

export const INDEXES_FOOTER: FooterChip[] = [
  ...toFooter([INDEXES_SHORTCUTS[0]!, INDEXES_SHORTCUTS[1]!, INDEXES_SHORTCUTS[2]!]),
  { keys: 'n/i', label: 'sort collections' },
  { keys: 's/o', label: 'sort size/ops' },
]
