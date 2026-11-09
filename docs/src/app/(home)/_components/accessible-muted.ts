/** WCAG AA normal-text contrast target (4.5:1). */
const minContrastRatio = 4.5

type Rgb = readonly [number, number, number]

function parseHexColor(hex: string): Rgb {
  const value = hex.replace('#', '')
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function formatHexColor([red, green, blue]: Rgb): string {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function mixHexColors(from: string, to: string, amountTowardTo: number): string {
  const start = parseHexColor(from)
  const end = parseHexColor(to)
  return formatHexColor([
    Math.round(start[0] + (end[0] - start[0]) * amountTowardTo),
    Math.round(start[1] + (end[1] - start[1]) * amountTowardTo),
    Math.round(start[2] + (end[2] - start[2]) * amountTowardTo),
  ])
}

function channelLuminance(channel: number): number {
  const value = channel / 255
  if (value <= 0.03928) {
    return value / 12.92
  }
  return ((value + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = parseHexColor(hex)
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  )
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Mix `foreground` toward `blendToward` until it clears WCAG AA against every surface.
 * Keeps theme colours when they already pass; lifts failing ones (e.g. gruvbox muted /
 * error on the title-bar panel) without rewriting the generated palette file.
 */
export function accessibleForegroundColor(
  foreground: string,
  blendToward: string,
  surfaces: readonly string[],
): string {
  if (surfaces.every((surface) => contrastRatio(foreground, surface) >= minContrastRatio)) {
    return foreground
  }

  let amount = 0.02
  let candidate = foreground
  while (amount <= 1) {
    candidate = mixHexColors(foreground, blendToward, amount)
    if (surfaces.every((surface) => contrastRatio(candidate, surface) >= minContrastRatio)) {
      return candidate
    }
    amount += 0.02
  }

  return blendToward
}

/** Match `color-mix(in srgb, color percent%, card)` used by `paletteStyle` tints. */
export function tintWithCard(color: string, percent: number, card: string): string {
  return mixHexColors(card, color, percent / 100)
}
