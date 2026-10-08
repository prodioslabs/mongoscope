import { type FooterChip, type Shortcut, toFooter } from './types'

export const QUERY_DETAIL_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: '↑/↓ / j/k',
    helpLabel: 'Scroll details',
    footerLabel: 'scroll',
    footerKeys: '↑↓',
    bindings: [
      { key: 'up', cmd: 'query-detail.scroll-up' },
      { key: 'k', cmd: 'query-detail.scroll-up' },
      { key: 'down', cmd: 'query-detail.scroll-down' },
      { key: 'j', cmd: 'query-detail.scroll-down' },
    ],
  },
  {
    keys: 'pgup/pgdn',
    helpLabel: 'Page scroll',
    bindings: [
      { key: 'pageup', cmd: 'query-detail.page-up' },
      { key: 'pagedown', cmd: 'query-detail.page-down' },
    ],
  },
  {
    keys: 'r',
    helpLabel: 'Toggle raw sample',
    footerLabel: 'raw',
    bindings: [{ key: 'r', cmd: 'query-detail.toggle-raw' }],
  },
  {
    keys: 'c',
    helpLabel: 'Copy displayed detail (raw or curated)',
    footerLabel: 'copy',
    bindings: [{ key: 'c', cmd: 'query-detail.copy-detail' }],
  },
  {
    keys: 's',
    helpLabel: 'Copy suggested index command',
    footerLabel: 'suggest',
    bindings: [{ key: 's', cmd: 'query-detail.copy-suggest' }],
  },
  {
    keys: 'i',
    helpLabel: 'Jump to Indexes (focus collection + suggested vs existing)',
    footerLabel: 'indexes',
    bindings: [{ key: 'i', cmd: 'query-detail.open-indexes' }],
  },
  {
    keys: 'esc',
    helpLabel: 'Close details',
    footerLabel: 'close',
    bindings: [{ key: 'escape', cmd: 'query-detail.close' }],
  },
]

/** Footer chip for `r` flips between raw and curated. */
export function queryDetailFooter(showRaw: boolean): FooterChip[] {
  return toFooter(QUERY_DETAIL_SHORTCUTS).map((chip) =>
    chip.keys === 'r' ? { ...chip, label: showRaw ? 'curated' : 'raw' } : chip,
  )
}
