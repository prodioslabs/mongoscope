import { useBindings } from '@opentui/keymap/react'
import { useRenderer } from '@opentui/react'
import { useRef, useState } from 'react'
import { match } from 'ts-pattern'
import { CommandPalette } from './components/command-palette'
import { ConnectionsDialog } from './components/connections/connections-dialog'
import { Dashboard } from './components/dashboard'
import { Footer } from './components/footer'
import { HelpMenu } from './components/help-menu'
import { WelcomeScreen } from './components/welcome-screen'
import { useSyncLiveConnection } from './hooks/use-sync-live-connection'
import { type AppKeymapMode } from './lib/keymap-mode'
import { whenNotEditing } from './lib/when-not-editing'
import {
  DASHBOARD_SHORTCUTS,
  GLOBAL_ALWAYS_ON_SHORTCUTS,
  GLOBAL_BASE_SHORTCUTS,
  nextTab,
  previousTab,
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
  const activeTab = useSession((s) => s.activeTab)
  const notEditing = whenNotEditing(renderer)

  useSyncLiveConnection()

  const modeRef = useRef(mode)
  const selectedRef = useRef(selected)
  const allRef = useRef(all)
  const setModeRef = useRef(setMode)
  const setRef = useRef(set)
  const setTabRef = useRef(setTab)
  const activeTabRef = useRef(activeTab)
  const screenRef = useRef(screen)
  const setPaletteOpenRef = useRef(setPaletteOpen)
  const setHelpMenuOpenRef = useRef(setHelpMenuOpen)

  modeRef.current = mode
  selectedRef.current = selected
  allRef.current = all
  setModeRef.current = setMode
  setRef.current = set
  setTabRef.current = setTab
  activeTabRef.current = activeTab
  screenRef.current = screen
  setPaletteOpenRef.current = setPaletteOpen
  setHelpMenuOpenRef.current = setHelpMenuOpen

  function blurFocusedInput() {
    const focused = renderer.currentFocusedRenderable
    if (focused != null && typeof focused.blur === 'function') {
      focused.blur()
    }
  }

  useBindings(
    function createAlwaysOnAppLayer() {
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
            // Avoid stealing `?` while typing in an input.
            enabled: notEditing,
            run() {
              setPaletteOpenRef.current(false)
              setHelpMenuOpenRef.current((open) => !open)
            },
          },
        ],
        bindings: toBindings(GLOBAL_ALWAYS_ON_SHORTCUTS),
      }
    },
    [notEditing],
  )

  useBindings(
    function createBaseAppLayer() {
      return {
        appMode: 'base' satisfies AppKeymapMode,
        // q / m / t must not fire while an <input> is focused (e.g. typing "staging").
        enabled: notEditing,
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
    [notEditing, renderer],
  )

  useBindings(
    function createDashboardTabLayer() {
      return {
        appMode: 'base' satisfies AppKeymapMode,
        // Digits / Tab must type into URI fields; only switch tabs when not editing.
        priority: 200,
        enabled: function dashboardTabsEnabled() {
          return screenRef.current === 'dashboard' && notEditing()
        },
        commands: [
          {
            name: 'app.select-tab',
            run({ event }: { event: { name: string } }) {
              const tab = tabFromKey(event.name)
              if (!tab) {
                return false
              }
              blurFocusedInput()
              setTabRef.current(tab)
            },
          },
          {
            name: 'app.cycle-tab-next',
            run() {
              blurFocusedInput()
              setTabRef.current(nextTab(activeTabRef.current))
            },
          },
          {
            name: 'app.cycle-tab-prev',
            run() {
              blurFocusedInput()
              setTabRef.current(previousTab(activeTabRef.current))
            },
          },
        ],
        bindings: toBindings(DASHBOARD_SHORTCUTS),
      }
    },
    [notEditing, renderer],
  )

  const body = match(screen)
    .with('welcome', () => <WelcomeScreen logDir={options.logDir ?? '.'} />)
    .with('dashboard', () => <Dashboard />)
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
      <ConnectionsDialog />
      <HelpMenu open={helpMenuOpen} onOpenChange={setHelpMenuOpen} />
    </box>
  )
}
