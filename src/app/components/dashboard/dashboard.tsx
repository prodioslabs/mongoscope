import { match } from 'ts-pattern'
import { DASHBOARD_SHORTCUTS, toFooter } from '../../shortcuts'
import { FooterKeybindingScope } from '../footer-keybindings'
import { useSession } from '../../stores/session'
import { IndexesTab } from '../indexes/indexes-tab'
import { LiveOpsTab } from '../live-ops/live-ops-tab'
import { LogsTab } from '../logs/logs-tab'
import { ReplicationTab } from '../replication/replication-tab'
import { SlowQueriesTab } from '../slow-queries/slow-queries-tab'
import { TabBar } from '../tab-bar'

const DASHBOARD_KEYBINDINGS = toFooter(DASHBOARD_SHORTCUTS)

export function Dashboard() {
  const activeTab = useSession((s) => s.activeTab)
  const logPath = useSession((s) => s.logPath)
  const parseDurationMs = useSession((s) => s.parseDurationMs)

  const status =
    logPath != null && parseDurationMs != null
      ? `${logPath} · parsed in ${formatParseDuration(parseDurationMs)}`
      : null

  const content = match(activeTab)
    .with('slow-queries', () => <SlowQueriesTab />)
    .with('live-ops', () => <LiveOpsTab />)
    .with('replication', () => <ReplicationTab />)
    .with('indexes', () => <IndexesTab />)
    .with('logs', () => <LogsTab />)
    .exhaustive()

  return (
    <FooterKeybindingScope bindings={DASHBOARD_KEYBINDINGS} status={status}>
      <box flexGrow={1} flexShrink={1} flexDirection="column">
        <TabBar />
        {content}
      </box>
    </FooterKeybindingScope>
  )
}

function formatParseDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  const seconds = ms / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const rem = Math.round(seconds % 60)
  return `${minutes}m ${rem}s`
}
