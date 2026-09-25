import { useLiveOpsSnapshot } from '../../../queries/live-ops'
import { useLiveConnection } from '../../../stores/live-connection'
import { DbSelector } from '../../db-selector'
import { LiveConnectionGate } from '../../live-connection-gate'
import { LiveOpsDashboard } from '../live-ops-dashboard'

export function LiveOpsTab() {
  const liveStatus = useLiveConnection((s) => s.status)
  const dashboardEnabled = liveStatus === 'connected'
  const { data: snapshot, isPending } = useLiveOpsSnapshot(dashboardEnabled)

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column">
      <DbSelector />
      <LiveConnectionGate>
        <LiveOpsDashboard snapshot={snapshot} isPending={isPending} />
      </LiveConnectionGate>
    </box>
  )
}
