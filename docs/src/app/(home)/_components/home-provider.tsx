'use client'

import { useSearchContext } from 'fumadocs-ui/contexts/search'
import { useTheme } from 'next-themes'
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'
import { previewTabs } from './demo-data'
import { ShortcutsDialog } from './shortcuts-dialog'
import { defaultTuiTheme, tuiThemeNames, tuiThemes, type TuiThemeName } from './tui-themes'

export type QuitState = 'idle' | 'confirm' | 'exited'

export type KeyLogEntry = {
  id: number
  key: string
  message: string
}

/** Returns true when a hovered or focused demo card consumed the key. */
export type ScopedKeyHandler = (key: string) => boolean

/** Page-wide keys, mirroring the TUI's global shortcuts. */
export type GlobalKey = '1' | '2' | '3' | '4' | '5' | 'tab' | 'm' | 't' | 'q' | '?' | 'ctrl+k'

type HomeState = {
  tuiTheme: TuiThemeName
  tabIndex: number
  keyLog: KeyLogEntry[]
  quitState: QuitState
  pressedKeys: ReadonlySet<string>
  shortcutsEnabled: boolean
  /** Null until mounted — next-themes only knows the mode on the client. */
  colorMode: 'light' | 'dark' | null
}

type HomeActions = {
  runKey: (key: GlobalKey) => void
  selectTab: (index: number) => void
  answerQuit: (quit: boolean) => void
  restart: () => void
  setShortcutsEnabled: (enabled: boolean) => void
  claimKeys: (owner: string, handler: ScopedKeyHandler | null) => void
  setMiniTerminalVisible: (visible: boolean) => void
}

const HomeStateContext = createContext<HomeState | null>(null)
const HomeActionsContext = createContext<HomeActions | null>(null)

export function useHomeState() {
  const value = use(HomeStateContext)
  if (!value) throw new Error('useHomeState must be used inside HomeProvider')
  return value
}

export function useHomeActions() {
  const value = use(HomeActionsContext)
  if (!value) throw new Error('useHomeActions must be used inside HomeProvider')
  return value
}

const shortcutsStorageKey = 'mongoscope:page-shortcuts'
const keyLogLimit = 7
const pressedKeyMs = 170
const toastMs = 1900
const globalKeys = new Set<string>(['1', '2', '3', '4', '5', 'm', 't', 'q', '?'])

/** Page accent follows the TUI theme: its light-mode accent on light, dark-mode accent on dark. */
const accentVars = cn(
  '[--home-accent:var(--home-accent-light)] dark:[--home-accent:var(--home-accent-dark)]',
  '[--home-accent-ink:color-mix(in_srgb,var(--home-accent)_70%,black)] dark:[--home-accent-ink:var(--home-accent)]',
  '[--home-accent-soft:color-mix(in_srgb,var(--home-accent)_14%,transparent)]',
)

type HomeProviderProps = {
  children: ReactNode
}

export function HomeProvider({ children }: HomeProviderProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const { setOpenSearch } = useSearchContext()
  const mounted = useSyncExternalStore(subscribeNever, getMountedSnapshot, getMountedServerSnapshot)

  const [tuiTheme, setTuiTheme] = useState<TuiThemeName>(defaultTuiTheme)
  const [tabIndex, setTabIndex] = useState(0)
  const [keyLog, setKeyLog] = useState<KeyLogEntry[]>([])
  const [quitState, setQuitState] = useState<QuitState>('idle')
  const [pressedKeys, setPressedKeys] = useState<ReadonlySet<string>>(() => new Set())
  const shortcutsEnabled = useSyncExternalStore(
    subscribeShortcutPreference,
    readShortcutPreference,
    getDefaultShortcutPreference,
  )
  const [helpOpen, setHelpOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)

  const colorMode = mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : null

  // Latest values for the long-lived keydown listener and the stable actions below.
  const latest = useRef({ tuiTheme, tabIndex, quitState, shortcutsEnabled, helpOpen, colorMode })
  const latestCallbacks = useRef({ setTheme, setOpenSearch })
  const scopedKeys = useRef<{ owner: string; handler: ScopedKeyHandler } | null>(null)
  const miniTerminalVisible = useRef(false)
  const nextLogId = useRef(0)
  const timers = useRef(new Set<number>())

  useEffect(function syncLatestState() {
    latest.current = { tuiTheme, tabIndex, quitState, shortcutsEnabled, helpOpen, colorMode }
    latestCallbacks.current = { setTheme, setOpenSearch }
  })

  useEffect(
    function hideToastLater() {
      if (!toast) return
      const timer = window.setTimeout(() => setToast(null), toastMs)
      return () => window.clearTimeout(timer)
    },
    [toast],
  )

  useEffect(function clearTimersOnUnmount() {
    const pending = timers.current
    return () => {
      for (const timer of pending) window.clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const { actions, flash, logKey, perform } = useMemo(() => {
    function later(run: () => void, ms: number) {
      const timer = window.setTimeout(() => {
        timers.current.delete(timer)
        run()
      }, ms)
      timers.current.add(timer)
    }

    function flash(keys: string[]) {
      setPressedKeys((previous) => new Set([...previous, ...keys]))
      later(() => {
        setPressedKeys((previous) => {
          const next = new Set(previous)
          for (const key of keys) next.delete(key)
          return next
        })
      }, pressedKeyMs)
    }

    function logKey(key: string, message: string) {
      const id = nextLogId.current++
      setKeyLog((previous) => [...previous, { id, key, message }].slice(-keyLogLimit))
    }

    /** Toast only when the keyboard section's mini terminal is off-screen. */
    function announce(message: string) {
      if (!miniTerminalVisible.current) setToast({ id: Date.now(), message })
    }

    function selectTab(index: number) {
      setTabIndex(((index % previewTabs.length) + previewTabs.length) % previewTabs.length)
    }

    function restart() {
      setQuitState('idle')
      nextLogId.current += 1
      setKeyLog([{ id: nextLogId.current, key: '↵', message: 'mongoscope started' }])
    }

    function answerQuit(quit: boolean) {
      setQuitState(quit ? 'exited' : 'idle')
      if (!quit) logKey('n', 'quit cancelled')
    }

    function perform(key: GlobalKey) {
      const state = latest.current
      switch (key) {
        case 'm': {
          const next = state.colorMode === 'dark' ? 'light' : 'dark'
          latestCallbacks.current.setTheme(next)
          logKey('m', `mode → ${next}`)
          announce(`m · ${next} mode`)
          return
        }
        case 't': {
          const index = tuiThemeNames.indexOf(state.tuiTheme)
          const next = tuiThemeNames[(index + 1) % tuiThemeNames.length] ?? defaultTuiTheme
          setTuiTheme(next)
          logKey('t', `theme → ${next}`)
          announce(`t · theme → ${next}`)
          return
        }
        case 'q':
          logKey('q', 'quit?')
          setQuitState('confirm')
          if (!miniTerminalVisible.current) {
            document.getElementById('shortcuts')?.scrollIntoView({
              behavior: prefersReducedMotion() ? 'auto' : 'smooth',
              block: 'center',
            })
          }
          return
        case '?':
          logKey('?', 'help')
          setHelpOpen(true)
          return
        case 'ctrl+k':
          logKey('ctrl+k', 'search docs')
          latestCallbacks.current.setOpenSearch(true)
          return
        case 'tab': {
          const next = (state.tabIndex + 1) % previewTabs.length
          selectTab(next)
          logKey('tab', `tab → ${previewTabs[next]}`)
          announce(`tab · ${previewTabs[next]}`)
          return
        }
        default: {
          const next = Number(key) - 1
          selectTab(next)
          logKey(key, `tab → ${previewTabs[next]}`)
          announce(`${key} · ${previewTabs[next]}`)
        }
      }
    }

    const actions: HomeActions = {
      runKey(key) {
        const state = latest.current
        if (state.quitState === 'exited') {
          restart()
          return
        }
        if (state.quitState === 'confirm') setQuitState('idle')
        flash(key === 'ctrl+k' ? ['ctrl', 'k'] : [key])
        perform(key)
      },
      selectTab,
      answerQuit,
      restart,
      setShortcutsEnabled: writeShortcutPreference,
      claimKeys(owner, handler) {
        if (handler) {
          scopedKeys.current = { owner, handler }
        } else if (scopedKeys.current?.owner === owner) {
          scopedKeys.current = null
        }
      },
      setMiniTerminalVisible(visible) {
        miniTerminalVisible.current = visible
      },
    }

    return { actions, flash, logKey, perform }
  }, [])

  useEffect(
    function listenForPageShortcuts() {
      function onKeyDown(event: KeyboardEvent) {
        if (event.repeat) return
        // Fumadocs opens search on this chord (and may preventDefault first); mirror it only.
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          flash(['ctrl', 'k'])
          logKey('ctrl+k', 'search docs')
          return
        }
        const state = latest.current
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
        if (state.helpOpen || !state.shortcutsEnabled || isTypingTarget(event.target)) return

        if (state.quitState === 'exited') {
          if (event.key.length === 1) {
            event.preventDefault()
            actions.restart()
          }
          return
        }
        if (state.quitState === 'confirm') {
          if (event.key === 'y' || event.key === 'n' || event.key === 'Escape') {
            event.preventDefault()
            actions.answerQuit(event.key === 'y')
          }
          return
        }

        const key = event.key === ' ' ? 'space' : event.key
        if (scopedKeys.current?.handler(key)) {
          event.preventDefault()
          return
        }
        if (!globalKeys.has(key)) return
        event.preventDefault()
        flash([key])
        perform(key as GlobalKey)
      }

      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    },
    [actions, flash, logKey, perform],
  )

  const state = useMemo<HomeState>(
    () => ({ tuiTheme, tabIndex, keyLog, quitState, pressedKeys, shortcutsEnabled, colorMode }),
    [tuiTheme, tabIndex, keyLog, quitState, pressedKeys, shortcutsEnabled, colorMode],
  )

  return (
    <HomeActionsContext value={actions}>
      <HomeStateContext value={state}>
        <div
          style={paletteStyle(tuiTheme)}
          className={cn('flex flex-1 flex-col overflow-x-clip', accentVars)}
        >
          {children}
          <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'pointer-events-none fixed bottom-6 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 truncate rounded-full bg-fd-foreground px-3.5 py-2 text-[0.8125rem] font-medium text-fd-background shadow-lg transition-[opacity,translate] duration-200',
              toast ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
            )}
          >
            {toast?.message}
          </div>
        </div>
      </HomeStateContext>
    </HomeActionsContext>
  )
}

function paletteStyle(name: TuiThemeName): CSSProperties {
  const palette = tuiThemes[name]
  return {
    '--tui-bg': palette.background,
    '--tui-panel': palette.panel,
    '--tui-border': palette.border,
    '--tui-fg': palette.text,
    '--tui-muted': palette.muted,
    '--tui-primary': palette.primary,
    '--tui-accent': palette.accent,
    '--tui-info': palette.info,
    '--tui-success': palette.success,
    '--tui-warning': palette.warning,
    '--tui-error': palette.error,
    '--home-accent-light': palette.accentLight,
    '--home-accent-dark': palette.accent,
  } as CSSProperties
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.matches(
        'textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="button"])',
      ))
  )
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function subscribeNever() {
  return () => {}
}

function getMountedSnapshot() {
  return true
}

function getMountedServerSnapshot() {
  return false
}

const shortcutListeners = new Set<() => void>()
/** Used when localStorage is blocked, so the switch still works for this visit. */
let shortcutsFallback = true

function subscribeShortcutPreference(listener: () => void) {
  shortcutListeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    shortcutListeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function readShortcutPreference() {
  try {
    const stored = localStorage.getItem(shortcutsStorageKey)
    return stored === null ? shortcutsFallback : stored !== 'off'
  } catch {
    return shortcutsFallback
  }
}

function getDefaultShortcutPreference() {
  return true
}

function writeShortcutPreference(enabled: boolean) {
  shortcutsFallback = enabled
  try {
    localStorage.setItem(shortcutsStorageKey, enabled ? 'on' : 'off')
  } catch {
    // Storage blocked — the in-memory fallback carries the choice.
  }
  for (const listener of shortcutListeners) listener()
}
