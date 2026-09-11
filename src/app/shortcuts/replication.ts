import { type FooterChip, type Shortcut } from './types'

/**
 * Replication tab help entries. Connection open is owned by DbSelector
 * (`CONNECTIONS_TAB_SHORTCUTS`); these are help/footer documentation only.
 */
export const REPLICATION_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: 'c',
    helpLabel: 'Select or manage the MongoDB connection',
    footerLabel: 'connections',
    bindings: [],
  },
  {
    keys: '5s',
    helpLabel: 'Topology, oplog, heartbeats, and lag trend auto-refresh while this tab is open',
    bindings: [],
  },
  {
    keys: '10m',
    helpLabel: 'Lag trend covers samples since this connection opened (no backfill)',
    bindings: [],
  },
  {
    keys: 'log',
    helpLabel: 'Recent elections/state changes come from getLog RAM buffer (not a fixed 7d window)',
    bindings: [],
  },
]

/** No extra footer chips — DbSelector already contributes `c` / connections. */
export const REPLICATION_FOOTER: FooterChip[] = []
