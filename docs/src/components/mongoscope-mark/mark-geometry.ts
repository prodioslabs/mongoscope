export const markViewBox = '0 0 32 32'

/** Solid tile keeps the mark legible at 16px on light and dark tab bars. */
export const markTile = {
  x: 0.5,
  y: 0.5,
  size: 31,
  radius: 7.5,
} as const

export const markLens = {
  cx: 14,
  cy: 14,
  r: 8,
  strokeWidth: 3,
} as const

export const markHandle = {
  d: 'M19.8 19.8 L25.4 25.4',
  strokeWidth: 3.5,
} as const

/** Two healthy query bars… */
export const markBars = {
  d: 'M10.25 17.5 V15.6 M14 17.5 V13.4',
  strokeWidth: 2.2,
} as const

/** …and the slow spike the lens catches. */
export const markSpike = {
  d: 'M17.75 17.5 V10.75',
  strokeWidth: 2.2,
} as const

/**
 * CSS vars for the React mark (values in `globals.css`). Favicon bake still needs hex —
 * keep `markColors` identical to `--tui-mark-*`.
 */
export const markColorVars = {
  tile: 'var(--tui-mark-tile)',
  tileEdge: 'var(--tui-mark-tile-edge)',
  lens: 'var(--tui-mark-lens)',
  bars: 'var(--tui-mark-bars)',
  spike: 'var(--tui-mark-spike)',
} as const

/** Gruvbox-dark hexes for `scripts/generate-icon.ts` only. Mirror `--tui-mark-*` in globals.css. */
export const markColors = {
  tile: '#282828',
  tileEdge: '#3c3836',
  lens: '#ebdbb2',
  bars: '#8ec07c',
  spike: '#fe8019',
} as const
