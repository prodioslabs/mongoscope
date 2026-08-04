import { useEffect } from 'react'
import { match } from 'ts-pattern'
import { useFooter, type FooterKeybinding } from '../stores/footer'
import { FooterKeybindingScope } from '../stores/footer-keybindings'
import { useSession } from '../stores/session'
import { useTheme } from '../stores/theme'
import { SlowQueriesTab } from './slow-queries/slow-queries-tab'
import { TabBar } from './tab-bar'

const DASHBOARD_KEYBINDINGS: FooterKeybinding[] = [{ keys: '1-6', label: 'tabs' }]

export function Dashboard() {
  const activeTab = useSession((s) => s.activeTab)
  const logPath = useSession((s) => s.logPath)
  const parseDurationMs = useSession((s) => s.parseDurationMs)
  const setStatus = useFooter((s) => s.setStatus)

  useEffect(
    function syncDashboardFooterStatus() {
      // Slow Queries owns the mid-footer status while that tab is active.
      if (activeTab === 'slow-queries') {
        return
      }

      if (logPath == null || parseDurationMs == null) {
        setStatus(null)
        return function clearDashboardFooterStatus() {
          setStatus(null)
        }
      }

      setStatus(`${logPath} · parsed in ${formatParseDuration(parseDurationMs)}`)
      return function clearDashboardFooterStatus() {
        setStatus(null)
      }
    },
    [activeTab, logPath, parseDurationMs, setStatus],
  )

  const content = match(activeTab)
    .with('slow-queries', () => <SlowQueriesTab />)
    .with('live-ops', () => <TabPlaceholder name="Live Ops" />)
    .with('timeline', () => <TabPlaceholder name="Timeline" />)
    .with('replication', () => <TabPlaceholder name="Replication" />)
    .with('indexes', () => <TabPlaceholder name="Indexes" />)
    .with('logs', () => <TabPlaceholder name="Logs" />)
    .exhaustive()

  return (
    <FooterKeybindingScope bindings={DASHBOARD_KEYBINDINGS}>
      <box flexGrow={1} flexShrink={1} flexDirection="column" width="100%">
        <TabBar />
        {content}
      </box>
    </FooterKeybindingScope>
  )
}

function formatParseDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
  const minutes = Math.floor(seconds / 60)
  const rem = Math.round(seconds % 60)
  return `${minutes}m ${rem}s`
}

type TabPlaceholderProps = {
  name: string
}

function TabPlaceholder({ name }: TabPlaceholderProps) {
  const theme = useTheme((s) => s.theme)
  return (
    <box flexGrow={1} paddingLeft={1} paddingTop={1}>
      <text content={name} fg={theme.textMuted} />
    </box>
  )
}
