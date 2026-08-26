import type { RGBA } from '@opentui/core'
import { displayText } from '../../../../lib/display-text'
import { useTheme } from '../../../stores/theme'

type StatsCardProps = {
  label: string
  value: string
  valueColor?: RGBA
}

export function StatsCard({ label, value, valueColor }: StatsCardProps) {
  const theme = useTheme((s) => s.theme)

  return (
    <box
      flexShrink={0}
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.border}
      backgroundColor={theme.backgroundPanel}
      title={label}
      titleColor={theme.textMuted}
      paddingLeft={1}
      paddingRight={1}
    >
      <text content={displayText(value, '—')} fg={valueColor ?? theme.text} />
    </box>
  )
}
