import { type FooterChip, type Shortcut } from './types'

/** Open connections dialog from Live Ops / Indexes when saved connections exist. */
export const CONNECTIONS_TAB_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: 'c',
    helpLabel: 'Manage connections',
    footerLabel: 'connections',
    bindings: [{ key: 'c', cmd: 'connections.open-manage' }],
  },
]

export const CONNECTIONS_TAB_FOOTER: FooterChip[] = [
  { keys: 'c', label: 'connections' },
]
