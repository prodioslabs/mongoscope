import { TextAttributes } from '@opentui/core'
import { useTerminalDimensions } from '@opentui/react'
import type { LiveOpsSnapshot } from '../../../../live-ops'
import { displayText } from '../../../../lib/display-text'
import { useTheme } from '../../../stores/theme'
import { CollectionTop } from '../collection-top'
import { CurrentOpsTable } from '../current-ops-table'
import { LiveOpsSidebar } from '../live-ops-sidebar'

type LiveOpsDashboardProps = {
  snapshot: LiveOpsSnapshot | undefined
  isPending: boolean
}

const NARROW_WIDTH = 100
const SIDEBAR_WIDTH = 28

export function LiveOpsDashboard({ snapshot, isPending }: LiveOpsDashboardProps) {
  const theme = useTheme((s) => s.theme)
  const dimensions = useTerminalDimensions()
  const narrow = dimensions.width < NARROW_WIDTH

  const ops = snapshot?.ops ?? []
  const ownOpsOnly = snapshot?.ownOpsOnly ?? false
  const lockNote = snapshot?.lockNote ?? ''
  const lockWaits = snapshot?.lockWaits ?? []
  const connections = snapshot?.connections ?? null
  const queuedOps = snapshot?.queuedOps ?? null
  const collectionTop = snapshot?.collectionTop ?? []
  const errors = snapshot?.errors ?? {
    currentOp: null,
    serverStatus: null,
    top: null,
  }

  const table = (
    <CurrentOpsTable
      ops={ops}
      error={errors.currentOp}
      ownOpsOnly={ownOpsOnly}
      lockNote={lockNote}
      maxRows={narrow ? 6 : 10}
    />
  )

  const sidebar = (
    <LiveOpsSidebar
      connections={connections}
      queuedOps={queuedOps}
      lockWaits={lockWaits}
      serverStatusError={errors.serverStatus}
      currentOpError={errors.currentOp}
    />
  )

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column" paddingLeft={1} paddingRight={1}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0} paddingBottom={0}>
        <text
          content="currentOp() — active & queued"
          fg={theme.text}
          attributes={TextAttributes.BOLD}
        />
        <text
          content={displayText(isPending && snapshot == null ? 'refresh: …' : 'refresh: 1s')}
          fg={theme.textMuted}
        />
      </box>

      {narrow ? (
        <box flexGrow={1} flexShrink={1} flexDirection="column" gap={1}>
          {table}
          {sidebar}
        </box>
      ) : (
        <box flexGrow={1} flexShrink={1} flexDirection="row" gap={1}>
          <box flexGrow={1} flexShrink={1} flexDirection="column">
            {table}
          </box>
          <box width={SIDEBAR_WIDTH} flexShrink={0}>
            {sidebar}
          </box>
        </box>
      )}

      <CollectionTop rows={collectionTop} error={errors.top} maxRows={narrow ? 4 : 6} />
    </box>
  )
}
