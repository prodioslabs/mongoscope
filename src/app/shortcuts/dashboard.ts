import { TABS } from '../stores/session'
import { type Shortcut } from './types'

export const DASHBOARD_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: '1–6',
    helpLabel: 'Switch tabs',
    footerLabel: 'tabs',
    footerKeys: '1-6',
    bindings: TABS.map((tab) => ({ key: tab.key, cmd: 'app.select-tab' })),
  },
]
