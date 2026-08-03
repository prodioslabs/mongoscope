import { bold, fg, t } from '@opentui/core'
import { useKeyboard, useRenderer } from '@opentui/solid'

const MONGO_GREEN = '#00ED64'

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

  useKeyboard(function keyHandler(key) {
    if (key.name === 'q') {
      renderer.destroy()
    }
  })

  return (
    <box width="100%" height="100%" flexDirection="column">
      <box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
        <box flexDirection="row" alignItems="center">
          <text content={SCOPE} fg={MONGO_GREEN} />
          <box flexDirection="column" alignItems="flex-start">
            <ascii_font text="MongoScope" color="#FFFFFF" />
            <text content="a lens into your MongoDB" fg="#888888" />
          </box>
        </box>
      </box>
      <box
        width="100%"
        paddingLeft={1}
        paddingBottom={0}
        justifyContent="flex-end"
        flexDirection="row"
      >
        <text>{t`${bold(fg('#FFFFFF')('q'))} ${fg('#888888')('quit')}`}</text>
      </box>
    </box>
  )
}
