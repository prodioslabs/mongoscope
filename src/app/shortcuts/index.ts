import { DASHBOARD_SHORTCUTS } from './dashboard'
import { GLOBAL_SHORTCUTS } from './global'
import { SLOW_QUERIES_SHORTCUTS } from './slow-queries'
import { toHelpSection, type HelpSection } from './types'
import { WELCOME_SHORTCUTS } from './welcome'

export { DASHBOARD_SHORTCUTS } from './dashboard'
export {
  GLOBAL_ALWAYS_ON_SHORTCUTS,
  GLOBAL_BASE_SHORTCUTS,
  GLOBAL_FOOTER_SHORTCUTS,
  GLOBAL_SHORTCUTS,
} from './global'
export { SLOW_QUERIES_FOOTER, SLOW_QUERIES_SHORTCUTS } from './slow-queries'
export { toBindings, toFooter, toHelpSection, type HelpBinding, type HelpSection, type Shortcut } from './types'
export { WELCOME_PARSING_FOOTER, WELCOME_SHORTCUTS } from './welcome'

export const HELP_SECTIONS: HelpSection[] = [
  toHelpSection('Global', GLOBAL_SHORTCUTS),
  toHelpSection('Welcome', WELCOME_SHORTCUTS),
  toHelpSection('Dashboard', DASHBOARD_SHORTCUTS),
  toHelpSection('Slow Queries', SLOW_QUERIES_SHORTCUTS),
]
