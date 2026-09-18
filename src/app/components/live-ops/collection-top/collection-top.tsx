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

const NAMESPACE_WIDTH = 22
/** Fits labels up to "99999.9s" without wrapping a row. */
const TIME_WIDTH = 10
const DEFAULT_MAX_ROWS = 5

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
  maxRows = DEFAULT_MAX_ROWS,
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
    <box
      flexShrink={0}
      flexDirection="column"
      gap={0}
      paddingTop={1}
      border
      borderStyle="single"
      borderColor={theme.border}
      backgroundColor={theme.backgroundPanel}
      title=" collection top — read/write time "
      titleColor={theme.textMuted}
      titleAlignment="left"
      paddingLeft={1}
      paddingRight={1}
      paddingBottom={1}
    >
      <box flexDirection="row" justifyContent="flex-end" flexShrink={0}>
        <text content="mongotop style · 1s sample" fg={theme.textMuted} wrapMode="none" />
      </box>

      <CollectionTopLegend theme={theme} />

      {error != null ? (
        <text content={displayText(error.message)} fg={theme.error} wrapMode="none" />
      ) : baselinePending ? (
        <text content="waiting for first sample…" fg={theme.textMuted} wrapMode="none" />
      ) : rows.length === 0 ? (
        <text content="no activity in last interval" fg={theme.textMuted} wrapMode="none" />
      ) : (
        <box flexDirection="column" gap={0} flexShrink={0} height={maxRows}>
          {visibleRows.map(function renderTopRow(row) {
            const bars = collectionTopBarSegments(row.readMs, row.writeMs, barWidth, scaleMaxMs)
            const label = truncateLiveOpsCell(row.namespace, NAMESPACE_WIDTH)
            const time = truncateLiveOpsCell(formatTopTimeLabel(row.totalMs), TIME_WIDTH)
            return (
              <box key={row.namespace} flexDirection="row" gap={1} height={1} flexShrink={0}>
                <text
                  content={displayText(label.padEnd(NAMESPACE_WIDTH, ' '))}
                  fg={theme.text}
                  width={NAMESPACE_WIDTH}
                  wrapMode="none"
                  flexShrink={0}
                />
                <box
                  width={barWidth}
                  height={1}
                  flexShrink={0}
                  flexDirection="row"
                  backgroundColor={theme.backgroundElement}
                >
                  <text
                    content={buildCollectionTopBarContent(bars, theme)}
                    width={barWidth}
                    height={1}
                    wrapMode="none"
                    flexShrink={0}
                    flexGrow={0}
                  />
                </box>
                <text
                  content={displayText(time.padStart(TIME_WIDTH, ' '))}
                  fg={theme.textMuted}
                  width={TIME_WIDTH}
                  wrapMode="none"
                  flexShrink={0}
                />
              </box>
            )
          })}
        </box>
      )}
    </box>
  )
}

type CollectionTopLegendProps = {
  theme: Theme
}

function CollectionTopLegend({ theme }: CollectionTopLegendProps) {
  return (
    <box
      flexDirection="row"
      gap={2}
      flexShrink={0}
      paddingBottom={0}
      height={1}
      alignItems="center"
    >
      <box flexDirection="row" gap={1} flexShrink={0} height={1} alignItems="center">
        <LegendDot color={theme.success} />
        <text content="read time" fg={theme.textMuted} wrapMode="none" flexShrink={0} />
      </box>
      <box flexDirection="row" gap={1} flexShrink={0} height={1} alignItems="center">
        <LegendDot color={theme.error} />
        <text content="write time" fg={theme.textMuted} wrapMode="none" flexShrink={0} />
      </box>
    </box>
  )
}

type LegendDotProps = {
  color: Theme['success']
}

function LegendDot({ color }: LegendDotProps) {
  return <text content="■" fg={color} wrapMode="none" flexShrink={0} />
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
