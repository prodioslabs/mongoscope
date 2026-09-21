import { type FooterChip, type Shortcut, toFooter } from './types'

export const SLOW_QUERIES_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: '↑/↓ / j/k',
    helpLabel: 'Navigate rows',
    footerLabel: 'navigate',
    footerKeys: '↑↓/jk',
    bindings: [
      { key: 'up', cmd: 'slow-queries.move-up' },
      { key: 'k', cmd: 'slow-queries.move-up' },
      { key: 'down', cmd: 'slow-queries.move-down' },
      { key: 'j', cmd: 'slow-queries.move-down' },
    ],
  },
  {
    keys: 'enter',
    helpLabel: 'Open query details',
    footerLabel: 'details',
    bindings: [
      { key: 'enter', cmd: 'slow-queries.open-details' },
      { key: 'return', cmd: 'slow-queries.open-details' },
    ],
  },
  {
    keys: 'enter then i',
    helpLabel: 'Jump to Indexes for this namespace / suggested index (from query details)',
    bindings: [],
  },
  {
    keys: 'c',
    helpLabel: 'Sort by count',
    bindings: [{ key: 'c', cmd: 'slow-queries.sort-count' }],
  },
  {
    keys: 'a',
    helpLabel: 'Sort by avg ms',
    bindings: [{ key: 'a', cmd: 'slow-queries.sort-avg' }],
  },
  {
    keys: 'p',
    helpLabel: 'Sort by plan',
    bindings: [{ key: 'p', cmd: 'slow-queries.sort-plan' }],
  },
  {
    keys: 'shift+t',
    helpLabel: 'Cycle static log tail window (50k / 100k / 250k / 500k)',
    footerLabel: 'tail',
    footerKeys: 'T',
    bindings: [{ key: 'shift+t', cmd: 'slow-queries.cycle-tail' }],
  },
  {
    keys: 'l',
    helpLabel: 'Toggle Static log / Live profiler (when a connection is selected)',
    footerLabel: 'source',
    bindings: [{ key: 'l', cmd: 'slow-queries.toggle-source' }],
  },
  {
    keys: 'e',
    helpLabel: 'Enable profiler for selected database (live mode)',
    footerLabel: 'enable',
    bindings: [{ key: 'e', cmd: 'slow-queries.enable-open' }],
  },
  {
    keys: '[ / ]',
    helpLabel: 'Previous / next database (live mode)',
    footerLabel: 'db',
    footerKeys: '[]',
    bindings: [
      { key: '[', cmd: 'slow-queries.prev-database' },
      { key: ']', cmd: 'slow-queries.next-database' },
    ],
  },
]

/** Footer for static mode (default). */
export const SLOW_QUERIES_STATIC_FOOTER: FooterChip[] = [
  ...toFooter([SLOW_QUERIES_SHORTCUTS[0]!]),
  { keys: 'c/a/p', label: 'sort count/avg/plan' },
  { keys: 'T', label: 'tail' },
]

/** Footer for live profiler mode. */
export const SLOW_QUERIES_LIVE_FOOTER: FooterChip[] = [
  ...toFooter([SLOW_QUERIES_SHORTCUTS[0]!]),
  { keys: 'c/a/p', label: 'sort count/avg/plan' },
  { keys: '[]', label: 'db' },
  { keys: 'e', label: 'enable' },
  { keys: 'l', label: 'source' },
]

/** @deprecated use SLOW_QUERIES_STATIC_FOOTER / SLOW_QUERIES_LIVE_FOOTER */
export const SLOW_QUERIES_FOOTER: FooterChip[] = SLOW_QUERIES_STATIC_FOOTER

export const SLOW_QUERIES_ENABLE_CONFIRM_FOOTER: FooterChip[] = [
  { keys: 'enter', label: 'confirm' },
  { keys: 'esc', label: 'cancel' },
]
