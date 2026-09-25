type MongoScopeMarkProps = {
  className?: string
}

/**
 * MongoScope mark: magnifying lens over the TUI welcome-screen pulse waveform.
 * Ring/handle follow `currentColor`; the pulse uses `--ms-accent` (see global.css),
 * mirroring `theme.accent` in the TUI's gruvbox light/dark palettes.
 * Keep in sync with `src/app/icon.svg`.
 */
export function MongoScopeMark({ className }: MongoScopeMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <circle cx="13.5" cy="13.5" r="9" stroke="currentColor" strokeWidth="3" />
      <path d="M20.5 20.5 L28 28" stroke="currentColor" strokeWidth="3.5" />
      <path
        d="M7.5 13.5 H10.5 L12.5 9.5 L14.5 17.5 L16.5 13.5 H19.5"
        stroke="var(--ms-accent)"
        strokeWidth="2.25"
      />
    </svg>
  )
}
