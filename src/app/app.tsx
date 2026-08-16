import { useBindings, useKeymap } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import { useEffect, useRef, useState } from 'react'
import { match } from 'ts-pattern'
import { AddConnectionScreen } from './components/connections/add-connection-screen'
import { ConnectionsScreen } from './components/connections/connections-screen'
import { CommandPalette } from './components/command-palette'
import { Dashboard } from './components/dashboard'
import { Footer } from './components/footer'
import { WelcomeScreen } from './components/welcome-screen'
import { type AppKeymapMode } from './lib/keymap-mode'
import { TABS, tabFromKey, useSession } from './stores/session'
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
  const keymap = useKeymap()
  const { mode, setMode, set, selected, all } = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const screen = useSession((s) => s.screen)
  const setTab = useSession((s) => s.setTab)

  const modeRef = useRef(mode)
  const selectedRef = useRef(selected)
  const allRef = useRef(all)
  const setModeRef = useRef(setMode)
  const setRef = useRef(set)
  const setTabRef = useRef(setTab)
  const setPaletteOpenRef = useRef(setPaletteOpen)

  modeRef.current = mode
  selectedRef.current = selected
  allRef.current = all
  setModeRef.current = setMode
  setRef.current = set
  setTabRef.current = setTab
  setPaletteOpenRef.current = setPaletteOpen

  useEffect(
    function syncPaletteKeymapMode() {
      if (paletteOpen || screen === 'connection-add') {
        keymap.setData('app.mode', 'palette' satisfies AppKeymapMode)
        return
      }
      keymap.setData('app.mode', 'base' satisfies AppKeymapMode)
    },
    [keymap, paletteOpen, screen],
  )

  useBindings(function createAlwaysOnAppLayer() {
    return {
      commands: [
        {
          name: 'app.toggle-palette',
          run() {
            setPaletteOpenRef.current((open) => !open)
          },
        },
      ],
      bindings: [{ key: 'ctrl+k', cmd: 'app.toggle-palette' }],
    }
  }, [])

  useBindings(
    function createBaseAppLayer() {
      return {
        appMode: 'base' satisfies AppKeymapMode,
        commands: [
          {
            name: 'app.quit',
            run() {
              renderer.destroy()
            },
          },
          {
            name: 'app.toggle-mode',
            run() {
              setModeRef.current(modeRef.current === 'dark' ? 'light' : 'dark')
            },
          },
          {
            name: 'app.cycle-theme',
            run() {
              const names = Object.keys(allRef.current())
              const index = names.indexOf(selectedRef.current)
              const next = names[(index + 1) % names.length]
              if (next) setRef.current(next)
            },
          },
        ],
        bindings: [
          { key: 'q', cmd: 'app.quit' },
          { key: 'm', cmd: 'app.toggle-mode' },
          { key: 't', cmd: 'app.cycle-theme' },
        ],
      }
    },
    [renderer],
  )

  useBindings(
    function createDashboardTabLayer() {
      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: screen === 'dashboard',
        commands: [
          {
            name: 'app.select-tab',
            run({ event }: { event: { name: string } }) {
              const tab = tabFromKey(event.name)
              if (!tab) return false
              setTabRef.current(tab)
            },
          },
        ],
        bindings: TABS.map((tab) => ({ key: tab.key, cmd: 'app.select-tab' as const })),
      }
    },
    [screen],
  )

  const body = match(screen)
    .with('welcome', () => <WelcomeScreen logDir={options.logDir ?? '.'} />)
    .with('dashboard', () => <Dashboard />)
    .with('connections', () => <ConnectionsScreen />)
    .with('connection-add', () => <AddConnectionScreen />)
    .exhaustive()

  return (
    <box flexGrow={1} flexDirection="column">
      {body}
      <Footer />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </box>
  )
}
