import type { RGBA } from '@opentui/core'
import { displayText } from '../../../../lib/display-text'
import { useTheme } from '../../../stores/theme'

type StatsCardProps = {
  label: string
  value: string
  valueColor?: RGBA
}

/** Corners + one space on each side of a border title: `┌─ LABEL ─┐` */
const BORDER_TITLE_CHROME = 4
/** Left/right border + horizontal padding (paddingLeft/Right = 1 each). */
const VALUE_CHROME = 4

export function StatsCard({ label, value, valueColor }: StatsCardProps) {
  const theme = useTheme((s) => s.theme)
  const safeValue = displayText(value, '—')
  const minWidth = Math.max(label.length + BORDER_TITLE_CHROME, safeValue.length + VALUE_CHROME)

  return (
    <box
      flexShrink={0}
      flexDirection="column"
      border
      borderStyle="single"
      borderColor={theme.border}
      backgroundColor={theme.backgroundPanel}
      title={label}
      titleColor={theme.textMuted}
      titleAlignment="left"
      minWidth={minWidth}
      paddingLeft={1}
      paddingRight={1}
    >
      <text content={safeValue} fg={valueColor ?? theme.text} />
    </box>
  )
}
