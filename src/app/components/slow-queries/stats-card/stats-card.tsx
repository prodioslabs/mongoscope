import { TextAttributes, type RGBA } from '@opentui/core'
import { displayText } from '../../../../lib/display-text'
import { useTheme } from '../../../stores/theme'

type StatsCardProps = {
  label: string
  value: string
  icon?: string
  valueColor?: RGBA
}

/**
 * Equal-sized KPI card matching Live Ops sidebar boxes (connections / queued ops /
 * lock waits): bordered panel, bold muted label inside, value below — not a border title.
 */
export function StatsCard({ label, value, icon, valueColor }: StatsCardProps) {
  const theme = useTheme((s) => s.theme)
  const heading = icon != null && icon.length > 0 ? `${icon} ${label}` : label

  return (
    <box
      flexGrow={1}
      flexShrink={1}
      flexBasis={0}
      flexDirection="column"
      gap={0}
      height={4}
      minHeight={4}
      border
      borderStyle="single"
      borderColor={theme.border}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
    >
      <text
        content={displayText(heading, '—')}
        fg={theme.textMuted}
        attributes={TextAttributes.BOLD}
      />
      <text content={displayText(value, '—')} fg={valueColor ?? theme.text} />
    </box>
  )
}
