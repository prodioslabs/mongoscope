import { RGBA } from '@opentui/core'
import { getThemeCatalog } from './catalog'
import catppuccin from './assets/catppuccin.json' with { type: 'json' }
import catppuccinFrappe from './assets/catppuccin-frappe.json' with { type: 'json' }
import catppuccinMacchiato from './assets/catppuccin-macchiato.json' with { type: 'json' }
import github from './assets/github.json' with { type: 'json' }
import gruvbox from './assets/gruvbox.json' with { type: 'json' }
import nord from './assets/nord.json' with { type: 'json' }
import oneDark from './assets/one-dark.json' with { type: 'json' }
import synthwave84 from './assets/synthwave84.json' with { type: 'json' }
import tokyonight from './assets/tokyonight.json' with { type: 'json' }

export type Theme = {
  readonly primary: RGBA
  readonly secondary: RGBA
  readonly accent: RGBA
  readonly error: RGBA
  readonly warning: RGBA
  readonly success: RGBA
  readonly info: RGBA
  readonly text: RGBA
  readonly textMuted: RGBA
  readonly selectedListItemText: RGBA
  readonly background: RGBA
  readonly backgroundPanel: RGBA
  readonly backgroundElement: RGBA
  readonly backgroundMenu: RGBA
  readonly border: RGBA
  readonly borderActive: RGBA
  readonly borderSubtle: RGBA
  readonly diffAdded: RGBA
  readonly diffRemoved: RGBA
  readonly diffContext: RGBA
  readonly diffHunkHeader: RGBA
  readonly diffHighlightAdded: RGBA
  readonly diffHighlightRemoved: RGBA
  readonly diffAddedBg: RGBA
  readonly diffRemovedBg: RGBA
  readonly diffContextBg: RGBA
  readonly diffLineNumber: RGBA
  readonly diffAddedLineNumberBg: RGBA
  readonly diffRemovedLineNumberBg: RGBA
  readonly markdownText: RGBA
  readonly markdownHeading: RGBA
  readonly markdownLink: RGBA
  readonly markdownLinkText: RGBA
  readonly markdownCode: RGBA
  readonly markdownBlockQuote: RGBA
  readonly markdownEmph: RGBA
  readonly markdownStrong: RGBA
  readonly markdownHorizontalRule: RGBA
  readonly markdownListItem: RGBA
  readonly markdownListEnumeration: RGBA
  readonly markdownImage: RGBA
  readonly markdownImageText: RGBA
  readonly markdownCodeBlock: RGBA
  readonly syntaxComment: RGBA
  readonly syntaxKeyword: RGBA
  readonly syntaxFunction: RGBA
  readonly syntaxVariable: RGBA
  readonly syntaxString: RGBA
  readonly syntaxNumber: RGBA
  readonly syntaxType: RGBA
  readonly syntaxOperator: RGBA
  readonly syntaxPunctuation: RGBA
  readonly thinkingOpacity: number
  _hasSelectedListItemText: boolean
}

type ThemeColor = Exclude<keyof Theme, 'thinkingOpacity' | '_hasSelectedListItemText'>

type HexColor = `#${string}`
type RefName = string
type Variant = {
  dark: HexColor | RefName
  light: HexColor | RefName
}
type ColorValue = HexColor | RefName | Variant | RGBA | number

export type ThemeJson = {
  $schema?: string
  defs?: Record<string, HexColor | RefName | number>
  theme: Omit<Record<ThemeColor, ColorValue>, 'selectedListItemText' | 'backgroundMenu'> & {
    selectedListItemText?: ColorValue
    backgroundMenu?: ColorValue
    thinkingOpacity?: number
  }
}

export const DEFAULT_THEMES: Record<string, ThemeJson> = {
  catppuccin: catppuccin as ThemeJson,
  'catppuccin-frappe': catppuccinFrappe as ThemeJson,
  'catppuccin-macchiato': catppuccinMacchiato as ThemeJson,
  github: github as ThemeJson,
  gruvbox: gruvbox as ThemeJson,
  nord: nord as ThemeJson,
  'one-dark': oneDark as ThemeJson,
  synthwave84: synthwave84 as ThemeJson,
  tokyonight: tokyonight as ThemeJson,
}

export function allThemes() {
  return getThemeCatalog()
}

export function isTheme(theme: unknown): theme is ThemeJson {
  if (typeof theme !== 'object' || theme === null || Array.isArray(theme)) return false
  const value = Reflect.get(theme, 'theme')
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function hasTheme(name: string) {
  if (!name) {
    return false
  }
  return allThemes()[name] !== undefined
}

function ansiToRgba(code: number): RGBA {
  if (code < 16) {
    const ansiColors = [
      '#000000',
      '#800000',
      '#008000',
      '#808000',
      '#000080',
      '#800080',
      '#008080',
      '#c0c0c0',
      '#808080',
      '#ff0000',
      '#00ff00',
      '#ffff00',
      '#0000ff',
      '#ff00ff',
      '#00ffff',
      '#ffffff',
    ]
    return RGBA.fromHex(ansiColors[code] ?? '#000000')
  }

  if (code < 232) {
    const index = code - 16
    const b = index % 6
    const g = Math.floor(index / 6) % 6
    const r = Math.floor(index / 36)
    const val = (x: number) => (x === 0 ? 0 : x * 40 + 55)
    return RGBA.fromInts(val(r), val(g), val(b))
  }

  if (code < 256) {
    const gray = (code - 232) * 10 + 8
    return RGBA.fromInts(gray, gray, gray)
  }

  return RGBA.fromInts(0, 0, 0)
}

export function resolveTheme(theme: ThemeJson, mode: 'dark' | 'light'): Theme {
  const defs = theme.defs ?? {}

  function resolveColor(c: ColorValue, chain: string[] = []): RGBA {
    if (c instanceof RGBA) return c
    if (typeof c === 'string') {
      if (c === 'transparent' || c === 'none') return RGBA.fromInts(0, 0, 0, 0)
      if (c.startsWith('#')) return RGBA.fromHex(c)
      if (chain.includes(c)) {
        throw new Error(`Circular color reference: ${[...chain, c].join(' -> ')}`)
      }
      const next = defs[c] ?? theme.theme[c as ThemeColor]
      if (next === undefined) {
        throw new Error(`Color reference "${c}" not found in defs or theme`)
      }
      return resolveColor(next, [...chain, c])
    }
    if (typeof c === 'number') {
      return ansiToRgba(c)
    }
    return resolveColor(c[mode], chain)
  }

  const resolved = Object.fromEntries(
    Object.entries(theme.theme)
      .filter(
        ([key]) =>
          key !== 'selectedListItemText' && key !== 'backgroundMenu' && key !== 'thinkingOpacity',
      )
      .map(([key, value]) => [key, resolveColor(value as ColorValue)]),
  ) as Partial<Record<ThemeColor, RGBA>>

  const hasSelectedListItemText = theme.theme.selectedListItemText !== undefined
  if (hasSelectedListItemText) {
    resolved.selectedListItemText = resolveColor(theme.theme.selectedListItemText!)
  } else {
    resolved.selectedListItemText = resolved.background
  }

  if (theme.theme.backgroundMenu !== undefined) {
    resolved.backgroundMenu = resolveColor(theme.theme.backgroundMenu)
  } else {
    resolved.backgroundMenu = resolved.backgroundElement
  }

  const thinkingOpacity = theme.theme.thinkingOpacity ?? 0.6

  return {
    ...resolved,
    _hasSelectedListItemText: hasSelectedListItemText,
    thinkingOpacity,
  } as Theme
}

export function selectedForeground(theme: Theme, bg?: RGBA): RGBA {
  if (theme._hasSelectedListItemText) {
    return theme.selectedListItemText
  }

  if (theme.background.a === 0) {
    const targetColor = bg ?? theme.primary
    const { r, g, b } = targetColor
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return luminance > 0.5 ? RGBA.fromInts(0, 0, 0) : RGBA.fromInts(255, 255, 255)
  }

  return theme.background
}
