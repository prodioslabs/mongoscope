import { TextAttributes } from '@opentui/core'
import { fg, StyledText } from '@opentui/core'
import {
  collectionTopBarSegments,
  formatTopTimeLabel,
  truncateLiveOpsCell,
  type CollectionTopRow,
  type LiveOpsPanelError,
} from '../../../../live-ops'
import { displayText } from '../../../../lib/display-text'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'

type CollectionTopProps = {
  rows: CollectionTopRow[]
  baselinePending: boolean
  error: LiveOpsPanelError | null
  barWidth?: number
  maxRows?: number
}

export function CollectionTop({
  rows,
  baselinePending,
  error,
  barWidth = 24,
  maxRows = 6,
}: CollectionTopProps) {
  const theme = useTheme((s) => s.theme)
  const visibleRows = rows.slice(0, maxRows)
  let scaleMaxMs = 0
  for (const row of visibleRows) {
    if (row.totalMs > scaleMaxMs) {
      scaleMaxMs = row.totalMs
    }
  }

  return (
    <box flexShrink={0} flexDirection="column" gap={0} paddingTop={1}>
      <text
        content="collection top — read/write time"
        fg={theme.textMuted}
        attributes={TextAttributes.BOLD}
        wrapMode="none"
      />
      {error != null ? (
        <text content={displayText(error.message)} fg={theme.error} wrapMode="none" />
      ) : baselinePending ? (
        <text content="waiting for first sample…" fg={theme.textMuted} wrapMode="none" />
      ) : rows.length === 0 ? (
        <text content="no activity in last interval" fg={theme.textMuted} wrapMode="none" />
      ) : (
        visibleRows.map(function renderTopRow(row) {
          const bars = collectionTopBarSegments(row.readMs, row.writeMs, barWidth, scaleMaxMs)
          const label = truncateLiveOpsCell(row.namespace, 20)
          const time = formatTopTimeLabel(row.totalMs)
          return (
            <box key={row.namespace} flexDirection="row" gap={1} height={1} flexShrink={0}>
              <text
                content={displayText(label.padEnd(20, ' '))}
                fg={theme.text}
                width={20}
                wrapMode="none"
                flexShrink={0}
              />
              <box width={barWidth} height={1} flexShrink={0} flexDirection="row">
                <text
                  content={buildCollectionTopBarContent(bars, theme)}
                  width={barWidth}
                  height={1}
                  wrapMode="none"
                  flexShrink={0}
                  flexGrow={0}
                />
              </box>
              <text content={displayText(time)} fg={theme.textMuted} wrapMode="none" flexShrink={0} />
            </box>
          )
        })
      )}
    </box>
  )
}

function buildCollectionTopBarContent(
  bars: { read: string; write: string; empty: string },
  theme: Theme,
): StyledText {
  const chunks = []
  if (bars.read.length > 0) {
    chunks.push(fg(theme.success)(bars.read))
  }
  if (bars.write.length > 0) {
    chunks.push(fg(theme.error)(bars.write))
  }
  if (bars.empty.length > 0) {
    chunks.push(fg(theme.borderSubtle)(bars.empty))
  }
  if (chunks.length === 0) {
    return new StyledText([fg(theme.borderSubtle)(' ')])
  }
  return new StyledText(chunks)
}
