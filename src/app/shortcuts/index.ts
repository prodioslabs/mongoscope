import { DASHBOARD_SHORTCUTS } from './dashboard'
import { CONNECTIONS_TAB_SHORTCUTS } from './connections-tab'
import { GLOBAL_SHORTCUTS } from './global'
import { INDEXES_SHORTCUTS } from './indexes'
import { LIVE_OPS_SHORTCUTS } from './live-ops'
import { LOGS_SHORTCUTS } from './logs'
import { QUERY_DETAIL_SHORTCUTS } from './query-detail'
import { REPLICATION_SHORTCUTS } from './replication'
import { SLOW_QUERIES_SHORTCUTS } from './slow-queries'
import { toHelpSection, type HelpSection } from './types'
import { WELCOME_SHORTCUTS } from './welcome'

export { CONNECTIONS_TAB_FOOTER, CONNECTIONS_TAB_SHORTCUTS } from './connections-tab'
export { DASHBOARD_SHORTCUTS } from './dashboard'
export { nextTab, previousTab } from './dashboard'
export {
  GLOBAL_ALWAYS_ON_SHORTCUTS,
  GLOBAL_BASE_SHORTCUTS,
  GLOBAL_FOOTER_SHORTCUTS,
  GLOBAL_SHORTCUTS,
} from './global'
export { INDEXES_FOOTER, INDEXES_SHORTCUTS } from './indexes'
export { LIVE_OPS_FOOTER, LIVE_OPS_KILL_CONFIRM_FOOTER, LIVE_OPS_SHORTCUTS } from './live-ops'
export { LOGS_FOOTER, LOGS_SHORTCUTS } from './logs'
export { QUERY_DETAIL_SHORTCUTS, queryDetailFooter } from './query-detail'
export { REPLICATION_FOOTER, REPLICATION_SHORTCUTS } from './replication'
export { SLOW_QUERIES_FOOTER, SLOW_QUERIES_SHORTCUTS } from './slow-queries'
export {
  toBindings,
  toFooter,
  toHelpSection,
  type HelpBinding,
  type HelpSection,
  type Shortcut,
} from './types'
export { WELCOME_PARSING_FOOTER, WELCOME_SHORTCUTS } from './welcome'

export const HELP_SECTIONS: HelpSection[] = [
  toHelpSection('Global', GLOBAL_SHORTCUTS),
  toHelpSection('Welcome', WELCOME_SHORTCUTS),
  toHelpSection('Dashboard', DASHBOARD_SHORTCUTS),
  toHelpSection('Slow Queries', SLOW_QUERIES_SHORTCUTS),
  toHelpSection('Live Ops', LIVE_OPS_SHORTCUTS),
  toHelpSection('Replication', REPLICATION_SHORTCUTS),
  toHelpSection('Indexes', INDEXES_SHORTCUTS),
  toHelpSection('Logs', LOGS_SHORTCUTS),
  toHelpSection('Query Detail', QUERY_DETAIL_SHORTCUTS),
  toHelpSection('Connections', CONNECTIONS_TAB_SHORTCUTS),
]
