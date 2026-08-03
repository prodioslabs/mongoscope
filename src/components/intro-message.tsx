import { useTheme } from '../stores/theme'

// Original "scope" mark: a monitor screen with a pulse waveform.
const SCOPE = [
  '  ▄███████████▄  ',
  '  █           █  ',
  '  █     █     █  ',
  '  █    ▄█▄    █  ',
  '  █ ▄▄▄█ █▄▄▄ █  ',
  '  █           █  ',
  '  ▀███████████▀  ',
].join('\n')

export function IntroMessage() {
  const theme = useTheme((s) => s.theme)

  return (
    <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
      <box flexDirection="row" alignItems="center">
        <text content={SCOPE} fg={theme.primary} />
        <box flexDirection="column" alignItems="flex-start">
          <ascii-font text="MongoScope" color={theme.text} />
          <text content="a lens into your MongoDB" fg={theme.textMuted} />
        </box>
      </box>
    </box>
  )
}
