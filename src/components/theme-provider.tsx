import { CliRenderEvents } from '@opentui/core'
import { useRenderer } from '@opentui/react'
import { useEffect, type ReactNode } from 'react'
import { useTheme, type ThemeMode } from '../stores/theme'
import { hasTheme } from '../theme'

export function ThemeProvider(props: { mode?: ThemeMode; theme?: string; children?: ReactNode }) {
  const renderer = useRenderer()
  const theme = useTheme((s) => s.theme)
  const setMode = useTheme((s) => s.setMode)
  const set = useTheme((s) => s.set)

  useEffect(() => {
    if (typeof props.theme === 'string' && hasTheme(props.theme)) set(props.theme)
  }, [props.theme, set])

  useEffect(() => {
    if (props.mode === 'dark' || props.mode === 'light') setMode(props.mode)
  }, [props.mode, setMode])

  useEffect(() => {
    const handle = (next: ThemeMode) => {
      setMode(next)
    }
    renderer.on(CliRenderEvents.THEME_MODE, handle)
    return () => {
      renderer.off(CliRenderEvents.THEME_MODE, handle)
    }
  }, [renderer, setMode])

  useEffect(() => {
    renderer.setBackgroundColor(theme.background)
  }, [renderer, theme.background])

  return <>{props.children}</>
}
