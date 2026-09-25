import { useIndexesSnapshot } from '../../../queries/indexes'
import { useLiveConnection } from '../../../stores/live-connection'
import { DbSelector } from '../../db-selector'
import { LiveConnectionGate } from '../../live-connection-gate'
import { IndexesDashboard } from '../indexes-dashboard'

export function IndexesTab() {
  const liveStatus = useLiveConnection((s) => s.status)
  const dashboardEnabled = liveStatus === 'connected'
  const { data: snapshot, isPending } = useIndexesSnapshot(dashboardEnabled)

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column">
      <DbSelector />
      <LiveConnectionGate>
        <IndexesDashboard snapshot={snapshot} isPending={isPending} />
      </LiveConnectionGate>
    </box>
  )
}
