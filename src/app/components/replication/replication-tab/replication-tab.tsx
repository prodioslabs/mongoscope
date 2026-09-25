import { useReplicationSnapshot } from '../../../queries/replication'
import { useLiveConnection } from '../../../stores/live-connection'
import { DbSelector } from '../../db-selector'
import { useFooterStatus } from '../../footer-keybindings'
import { LiveConnectionGate } from '../../live-connection-gate'
import { ReplicationDashboard } from '../replication-dashboard'

export function ReplicationTab() {
  const liveStatus = useLiveConnection((s) => s.status)
  const dashboardEnabled = liveStatus === 'connected'
  const { data, isPending } = useReplicationSnapshot(dashboardEnabled)

  // `c` / connections footer comes from DbSelector; only status is tab-owned.
  useFooterStatus(dashboardEnabled ? 'replication · refresh 5s' : null)

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column">
      <DbSelector />
      <LiveConnectionGate>
        <ReplicationDashboard data={data} isPending={isPending} />
      </LiveConnectionGate>
    </box>
  )
}
