import { match } from 'ts-pattern'
import { type FooterKeybinding } from '../stores/footer'
import { FooterKeybindingScope } from './footer-keybindings'
import { useSession } from '../stores/session'
import { useTheme } from '../stores/theme'
import { SlowQueriesTab } from './slow-queries/slow-queries-tab'
import { TabBar } from './tab-bar'

const DASHBOARD_KEYBINDINGS: FooterKeybinding[] = [{ keys: '1-6', label: 'tabs' }]

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
    .with('live-ops', () => <TabPlaceholder name="Live Ops" />)
    .with('timeline', () => <TabPlaceholder name="Timeline" />)
    .with('replication', () => <TabPlaceholder name="Replication" />)
    .with('indexes', () => <TabPlaceholder name="Indexes" />)
    .with('logs', () => <TabPlaceholder name="Logs" />)
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
