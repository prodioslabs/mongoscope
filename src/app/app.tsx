import { useKeyboard, useRenderer } from '@opentui/react'
import { useState } from 'react'
import { CommandPalette } from './components/command-palette'
import { Footer } from './components/footer'
import { IntroMessage } from './components/intro-message'
import { useTheme } from './stores/theme'

export type AppOptions = {
  logPath?: string
  logDir?: string
  uri?: string
  host?: string
  port?: number
  username?: string
  password?: string
  authDb?: string
}

type AppProps = {
  options: AppOptions
}

export function App({ options: _options }: AppProps) {
  const renderer = useRenderer()
  const { mode, setMode, set, selected, all } = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)

  useKeyboard(function keyHandler(key) {
    if (key.ctrl && key.name === 'k') {
      key.preventDefault()
      setPaletteOpen((open) => !open)
      return
    }

    if (paletteOpen) return

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
      <IntroMessage />
      <Footer />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </box>
  )
}
