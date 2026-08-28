import { TextAttributes } from '@opentui/core'
import {
  collectionTopBarWidths,
  formatTopTimeLabel,
  repeatBar,
  truncateLiveOpsCell,
  type CollectionTopDelta,
  type LiveOpsPanelError,
} from '../../../../live-ops'
import { displayText } from '../../../../lib/display-text'
import { useTheme } from '../../../stores/theme'

type CollectionTopProps = {
  rows: CollectionTopDelta[]
  error: LiveOpsPanelError | null
  barWidth?: number
  maxRows?: number
}

export function CollectionTop({
  rows,
  error,
  barWidth = 24,
  maxRows = 6,
}: CollectionTopProps) {
  const theme = useTheme((s) => s.theme)

  return (
    <box flexShrink={0} flexDirection="column" gap={0} paddingTop={1}>
      <text
        content="collection top — read/write time"
        fg={theme.textMuted}
        attributes={TextAttributes.BOLD}
      />
      {error != null ? (
        <text content={displayText(error.message)} fg={theme.error} />
      ) : rows.length === 0 ? (
        <text content="waiting for first sample…" fg={theme.textMuted} />
      ) : (
        rows.slice(0, maxRows).map(function renderTopRow(row) {
          const widths = collectionTopBarWidths(row.readMs, row.writeMs, barWidth)
          const label = truncateLiveOpsCell(row.namespace, 20)
          const time = formatTopTimeLabel(row.readMs, row.writeMs)
          return (
            <box key={row.namespace} flexDirection="row" gap={1}>
              <text content={displayText(label.padEnd(20, ' '))} fg={theme.text} flexShrink={0} />
              <text content={displayText(repeatBar(widths.readWidth))} fg={theme.success} flexShrink={0} />
              <text content={displayText(repeatBar(widths.writeWidth))} fg={theme.error} flexShrink={0} />
              <text
                content={displayText(repeatBar(widths.emptyWidth))}
                fg={theme.borderSubtle}
                flexShrink={0}
              />
              <text content={displayText(time)} fg={theme.textMuted} flexShrink={0} />
            </box>
          )
        })
      )}
    </box>
  )
}
