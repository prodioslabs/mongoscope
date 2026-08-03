import { CliRenderEvents } from '@opentui/core'
import { useRenderer } from '@opentui/react'
import { useEffect, type ReactNode } from 'react'
import { useTheme, type ThemeMode } from '../stores/theme'
import { hasTheme } from '../theme'

type ThemeProviderProps = {
  mode?: ThemeMode
  theme?: string
  children?: ReactNode
}

export function ThemeProvider({ mode, theme: themeName, children }: ThemeProviderProps) {
  const renderer = useRenderer()
  const theme = useTheme((s) => s.theme)
  const setMode = useTheme((s) => s.setMode)
  const set = useTheme((s) => s.set)

  useEffect(function syncThemeFromProps() {
    if (typeof themeName === 'string' && hasTheme(themeName)) set(themeName)
  }, [themeName, set])

  useEffect(function syncModeFromProps() {
    if (mode === 'dark' || mode === 'light') setMode(mode)
  }, [mode, setMode])

  useEffect(function subscribeRendererThemeMode() {
    const handle = (next: ThemeMode) => {
      setMode(next)
    }
    renderer.on(CliRenderEvents.THEME_MODE, handle)
    return () => {
      renderer.off(CliRenderEvents.THEME_MODE, handle)
    }
  }, [renderer, setMode])

  useEffect(function applyThemeBackground() {
    renderer.setBackgroundColor(theme.background)
  }, [renderer, theme.background])

  return <>{children}</>
}
