import { bold, fg, t } from '@opentui/core'
import { useFooter } from '../stores/footer'
import { useTheme } from '../stores/theme'

export function Footer() {
  const theme = useTheme((s) => s.theme)
  const keybindings = useFooter((s) => s.keybindings)

  return (
    <box
      width="100%"
      paddingLeft={1}
      paddingRight={1}
      paddingBottom={0}
      justifyContent="flex-end"
      flexDirection="row"
      gap={2}
      backgroundColor={theme.backgroundPanel}
    >
      {keybindings.map((binding) => (
        <text
          key={`${binding.keys}:${binding.label}`}
          content={t`${bold(fg(theme.text)(binding.keys))} ${fg(theme.textMuted)(binding.label)}`}
        />
      ))}
    </box>
  )
}
