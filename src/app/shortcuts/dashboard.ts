import { TABS, type AppTab } from '../stores/session'
import { type Shortcut } from './types'

export const DASHBOARD_SHORTCUTS: readonly Shortcut[] = [
  {
    keys: '1–6',
    helpLabel: 'Switch tabs',
    footerLabel: 'tabs',
    footerKeys: '1-6',
    bindings: TABS.map((tab) => ({ key: tab.key, cmd: 'app.select-tab' })),
  },
  {
    keys: 'tab / shift+tab',
    helpLabel: 'Next / previous tab',
    footerLabel: 'cycle',
    footerKeys: 'tab',
    bindings: [
      { key: 'tab', cmd: 'app.cycle-tab-next' },
      { key: 'shift+tab', cmd: 'app.cycle-tab-prev' },
    ],
  },
]

export function nextTab(current: AppTab): AppTab {
  const index = TABS.findIndex((tab) => tab.id === current)
  const nextIndex = index === -1 ? 0 : (index + 1) % TABS.length
  return TABS[nextIndex]!.id
}

export function previousTab(current: AppTab): AppTab {
  const index = TABS.findIndex((tab) => tab.id === current)
  const previousIndex = index <= 0 ? TABS.length - 1 : index - 1
  return TABS[previousIndex]!.id
}
