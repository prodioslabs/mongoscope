import { type FooterChip, type Shortcut } from './types'

/**
 * DbSelector + connections dialog. `c` opens the dialog when saved connections
 * exist (Live Ops / Replication / Indexes always; Slow Queries / Logs when
 * live or connecting). Empty state uses an inline add form (no `c`).
 */
export const CONNECTIONS_TAB_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: 'c',
    helpLabel: 'Open connections dialog (switch / manage / add)',
    footerLabel: 'connections',
    bindings: [{ key: 'c', cmd: 'connections.open-manage' }],
  },
  {
    keys: '↑/↓ / j/k',
    helpLabel: 'Navigate connections (in dialog)',
    bindings: [],
  },
  {
    keys: 'enter',
    helpLabel: 'Select connection (in dialog)',
    bindings: [],
  },
  {
    keys: 'a',
    helpLabel: 'Add connection (in dialog)',
    bindings: [],
  },
  {
    keys: 'e',
    helpLabel: 'Edit connection (in dialog)',
    bindings: [],
  },
  {
    keys: 'd',
    helpLabel: 'Delete connection (in dialog)',
    bindings: [],
  },
  {
    keys: 'esc',
    helpLabel: 'Close connections dialog',
    bindings: [],
  },
]

export const CONNECTIONS_TAB_FOOTER: FooterChip[] = [{ keys: 'c', label: 'connections' }]
