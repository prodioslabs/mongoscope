import { type Shortcut } from './types'

/**
 * Replication tab help entries. Connection open is owned by DbSelector
 * (`CONNECTIONS_TAB_SHORTCUTS`); these are help/footer documentation only.
 */
export const REPLICATION_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: 'c',
    helpLabel: 'Select or manage the MongoDB connection (DbSelector)',
    footerLabel: 'connections',
    bindings: [],
  },
  {
    keys: '5s',
    helpLabel:
      'Auto-refresh: topology, oplog window, heartbeats, lag trend, elections, write concern',
    bindings: [],
  },
  {
    keys: '10m',
    helpLabel: 'Lag trend: samples since this connection opened (~10m window, no backfill)',
    bindings: [],
  },
  {
    keys: 'log',
    helpLabel:
      'Recent elections/state changes from getLog RAM buffer (not durable multi-day history)',
    bindings: [],
  },
]
