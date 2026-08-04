import { useKeyboard, useRenderer } from '@opentui/react'
import { useState } from 'react'
import { match } from 'ts-pattern'
import { CommandPalette } from './components/command-palette'
import { Dashboard } from './components/dashboard'
import { Footer } from './components/footer'
import { WelcomeScreen } from './components/welcome-screen'
import { tabFromKey, useSession } from './stores/session'
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

export function App({ options }: AppProps) {
  const renderer = useRenderer()
  const { mode, setMode, set, selected, all } = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const screen = useSession((s) => s.screen)
  const setTab = useSession((s) => s.setTab)

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
      return
    }

    if (screen === 'dashboard') {
      const tab = tabFromKey(key.name)
      if (tab) {
        key.preventDefault()
        setTab(tab)
      }
    }
  })

  const body = match(screen)
    .with('welcome', () => <WelcomeScreen logDir={options.logDir ?? '.'} />)
    .with('dashboard', () => <Dashboard />)
    .exhaustive()

  return (
    <box width="100%" height="100%" flexDirection="column">
      {body}
      <Footer />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </box>
  )
}
