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
]

/** Footer collapses the three sort keys into one chip. Enter is help-only so chips stay readable. */
export const SLOW_QUERIES_FOOTER: FooterChip[] = [
  ...toFooter([SLOW_QUERIES_SHORTCUTS[0]!]),
  { keys: 'c/a/p', label: 'sort count/avg/plan' },
]
