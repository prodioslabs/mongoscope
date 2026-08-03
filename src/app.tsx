import { bold, fg, t } from '@opentui/core'
import { useKeyboard, useRenderer } from '@opentui/react'
import { useTheme } from './stores/theme'

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

export function App() {
  const renderer = useRenderer()
  const { theme, mode, setMode, set, selected, all } = useTheme()

  useKeyboard(function keyHandler(key) {
    if (key.name === 'q') {
      renderer.destroy()
      return
    }

    if (key.name === 'm') {
      setMode(mode === 'dark' ? 'light' : 'dark')
      return
    }

    if (key.name === 't') {
      const names = Object.keys(all())
      const index = names.indexOf(selected)
      const next = names[(index + 1) % names.length]
      if (next) set(next)
    }
  })

  return (
    <box width="100%" height="100%" flexDirection="column">
      <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
        <box flexDirection="row" alignItems="center">
          <text content={SCOPE} fg={theme.primary} />
          <box flexDirection="column" alignItems="flex-start">
            <ascii-font text="MongoScope" color={theme.text} />
            <text content="a lens into your MongoDB" fg={theme.textMuted} />
          </box>
        </box>
      </box>
      <box
        width="100%"
        paddingLeft={1}
        paddingBottom={0}
        justifyContent="flex-end"
        flexDirection="row"
        gap={2}
        backgroundColor={theme.backgroundPanel}
      >
        <text
          content={t`${bold(fg(theme.text)('q'))} ${fg(theme.textMuted)('quit')}  ${bold(fg(theme.text)('t'))} ${fg(theme.textMuted)('theme')}  ${bold(fg(theme.text)('m'))} ${fg(theme.textMuted)('mode')}`}
        />
        <text content={t`${fg(theme.textMuted)(selected)}/${fg(theme.textMuted)(mode)}`} />
      </box>
    </box>
  )
}
