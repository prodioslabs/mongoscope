# Agent guidelines

## Component props

Define a named props type (expanded, one field per line) and destructure it in the component signature. Rename when a prop collides with a local binding.

```tsx
// ❌ BAD
export function ThemeProvider(props: { mode?: ThemeMode; theme?: string; children?: ReactNode }) {
  return <>{props.children}</>
}

// ✅ GOOD
type ThemeProviderProps = {
  mode?: ThemeMode
  theme?: string
  children?: ReactNode
}

export function ThemeProvider({ mode, theme: themeName, children }: ThemeProviderProps) {
  return <>{children}</>
}
```

## React effects

Always pass a **named function** to `useEffect` and `useLayoutEffect`. The name must convey the effect’s role (what it synchronizes, subscribes to, or applies).

```tsx
// ❌ BAD — anonymous arrow hides intent in stacks and reviews
useEffect(() => {
  renderer.setBackgroundColor(theme.background)
}, [renderer, theme.background])

// ✅ GOOD — name states the effect’s job
useEffect(
  function applyThemeBackground() {
    renderer.setBackgroundColor(theme.background)
  },
  [renderer, theme.background],
)
```

Do not use anonymous arrow functions or unnamed function expressions for effect callbacks.

## Component file order

In a component module, the **exported** component is the first function/component in the file (after imports and module-level constants/types for that export). Private helpers and subcomponents used by it follow below, each with their props type colocated above the component.

```tsx
// imports
// module constants

type WelcomeScreenProps = {
  logDir: string
}

export function WelcomeScreen({ logDir }: WelcomeScreenProps) {
  // ...
}

function progressBar(percent: number): string {
  // ...
}

type LogFileSectionProps = {
  // ...
}

function LogFileSection({ ... }: LogFileSectionProps) {
  // ...
}
```

## Cursor Cloud specific instructions

MongoScope v2 is a single-package **terminal UI (TUI)** CLI for visualizing MongoDB logs. It has no HTTP server or network port. The toolchain is [Bun](https://bun.sh) (runtime + package manager); Bun lives at `~/.bun/bin` and is on `PATH` via `~/.bashrc`. All commands are defined in `package.json` `scripts`.

Non-obvious caveats for running/testing:

- `bun start` (alias for `bun bin/mongoscope`) renders a full-screen OpenTUI interface and **requires a real interactive TTY**. It will not render correctly if stdout is piped or run non-interactively; test it from an actual terminal (e.g. the Desktop pane). Key bindings: `Ctrl+K` command palette, `m` toggle light/dark, `t` cycle themes, `q` quit.
- The `--uri` / `--host` / `--port` / `--log-path` etc. flags are parsed but **not yet wired into the app**, so no MongoDB instance is needed to run or test the current UI.
- `bun run test` runs Vitest, but there are currently **no test files**, so it exits with code 1 and "No test files found" — this is expected, not an environment failure.
- The `lint` and `format` scripts mutate files (`oxlint --fix`, `oxfmt --write`). For check-only runs use `bunx oxlint` and `bunx oxfmt --check`.
- `bun run build` compiles a standalone binary to `dist/mongoscope` (~110MB, gitignored).
