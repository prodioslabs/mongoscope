import { useBindings } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import { useRef, useState } from 'react'
import { match } from 'ts-pattern'
import { AddConnectionScreen } from './components/connections/add-connection-screen'
import { ConnectionsScreen } from './components/connections/connections-screen'
import { CommandPalette } from './components/command-palette'
import { Dashboard } from './components/dashboard'
import { Footer } from './components/footer'
import { HelpMenu } from './components/help-menu'
import { WelcomeScreen } from './components/welcome-screen'
import { type AppKeymapMode } from './lib/keymap-mode'
import {
  DASHBOARD_SHORTCUTS,
  GLOBAL_ALWAYS_ON_SHORTCUTS,
  GLOBAL_BASE_SHORTCUTS,
  toBindings,
} from './shortcuts'
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
  const [helpMenuOpen, setHelpMenuOpen] = useState(false)
  const screen = useSession((s) => s.screen)
  const setTab = useSession((s) => s.setTab)

  const modeRef = useRef(mode)
  const selectedRef = useRef(selected)
  const allRef = useRef(all)
  const setModeRef = useRef(setMode)
  const setRef = useRef(set)
  const setTabRef = useRef(setTab)
  const setPaletteOpenRef = useRef(setPaletteOpen)
  const setHelpMenuOpenRef = useRef(setHelpMenuOpen)

  modeRef.current = mode
  selectedRef.current = selected
  allRef.current = all
  setModeRef.current = setMode
  setRef.current = set
  setTabRef.current = setTab
  setPaletteOpenRef.current = setPaletteOpen
  setHelpMenuOpenRef.current = setHelpMenuOpen

  useBindings(function createAlwaysOnAppLayer() {
    return {
      commands: [
        {
          name: 'app.toggle-palette',
          run() {
            setHelpMenuOpenRef.current(false)
            setPaletteOpenRef.current((open) => !open)
          },
        },
        {
          name: 'app.toggle-help',
          run() {
            setPaletteOpenRef.current(false)
            setHelpMenuOpenRef.current((open) => !open)
          },
        },
      ],
      bindings: toBindings(GLOBAL_ALWAYS_ON_SHORTCUTS),
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
        bindings: toBindings(GLOBAL_BASE_SHORTCUTS),
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
        bindings: toBindings(DASHBOARD_SHORTCUTS),
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
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpenHelpMenu={() => {
          setPaletteOpen(false)
          setHelpMenuOpen(true)
        }}
      />
      <HelpMenu open={helpMenuOpen} onOpenChange={setHelpMenuOpen} />
    </box>
  )
}
