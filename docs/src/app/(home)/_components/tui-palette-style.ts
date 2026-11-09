import type { CSSProperties } from 'react'
import { accessibleForegroundColor, tintWithCard } from './accessible-muted'
import { tuiThemes, type TuiThemeName } from './tui-themes'

/** Light-mode paper used by `color-mix(..., var(--tui-card))` — matches `:root` in globals.css. */
const lightCardHex = '#ffffff'

/**
 * The TUI theme's light and dark palettes, picked by the site's `color-scheme`
 * through `light-dark()` — terminals and accents follow `m` like in the app.
 *
 * Loaded on demand when the visitor cycles off the default gruvbox CSS in globals.
 */
export function paletteStyle(name: TuiThemeName): CSSProperties {
  const { light, dark } = tuiThemes[name]
  const pick = (key: keyof typeof light) => `light-dark(${light[key]}, ${dark[key]})`
  // Light surfaces at full strength (gruvbox cream, etc.) flood the page; keep a tint of
  // the theme on near-white paper and let the theme's text colours carry it.
  const tint = (key: keyof typeof light, percent: number) =>
    `light-dark(color-mix(in srgb, ${light[key]} ${percent}%, var(--tui-card)), ${dark[key]})`

  // Some theme tokens fail WCAG AA on title-bar / row chrome (e.g. gruvbox muted /
  // error on `#3c3836`). Lift toward text until both surfaces clear 4.5:1.
  const lightSurfaces = [
    tintWithCard(light.background, 30, lightCardHex),
    tintWithCard(light.panel, 50, lightCardHex),
  ] as const
  const darkSurfaces = [dark.background, dark.panel] as const
  const lightMuted = accessibleForegroundColor(light.muted, light.text, lightSurfaces)
  const darkMuted = accessibleForegroundColor(dark.muted, dark.text, darkSurfaces)
  const lightError = accessibleForegroundColor(light.error, light.text, lightSurfaces)
  const darkError = accessibleForegroundColor(dark.error, dark.text, darkSurfaces)
  const lightPrimary = accessibleForegroundColor(light.primary, light.text, lightSurfaces)
  const darkPrimary = accessibleForegroundColor(dark.primary, dark.text, darkSurfaces)

  return {
    '--tui-bg': tint('background', 30),
    '--tui-panel': tint('panel', 50),
    '--tui-border': tint('border', 55),
    '--tui-fg': pick('text'),
    '--tui-muted': `light-dark(${lightMuted}, ${darkMuted})`,
    '--tui-primary': `light-dark(${lightPrimary}, ${darkPrimary})`,
    '--tui-accent': pick('accent'),
    '--tui-info': pick('info'),
    '--tui-success': pick('success'),
    '--tui-warning': pick('warning'),
    '--tui-error': `light-dark(${lightError}, ${darkError})`,
    '--home-accent': pick('accent'),
    // Light accents are mid-tones; darken them for text on a light page.
    '--home-accent-ink': `light-dark(color-mix(in srgb, ${light.accent} 80%, var(--tui-ink)), ${dark.accent})`,
    '--home-accent-soft': 'color-mix(in srgb, var(--home-accent) 14%, transparent)',
  } as CSSProperties
}
