# Agent guidelines

## Folder placement

Put code next to its only consumer; promote on a second real consumer. Domain stays outside `app/`; React/OpenTUI stays inside `app/`.

| Kind of code | Where it goes | Must not |
| --- | --- | --- |
| Domain logic (pure, no OpenTUI) | Top-level `src/<domain>/` — today: `connections`, `parser`, `query-patterns` | Import from `app/` |
| Cross-domain pure utils | `src/lib/` by concern | Import domain modules |
| OpenTUI shell, screens, stores, shortcuts, theme, app config | `src/app/` | Own domain business rules |
| TUI-only helpers | `src/app/lib/` | Live in `src/lib/` |
| React Query / UI data hooks | `src/app/queries/` | Sit at top-level `src/queries/` |
| Feature screens + feature-private presentation | `src/app/components/<feature>/<name>/` | Premature extract to shared |
| Shared widgets / primitives (2+ features) | `src/app/components/<name>/` or `ui/` | Feature-private helpers |
| Process entry (yargs) | `src/cli/` | App UI |
| Tests | Colocated `*.test.ts` next to source | Separate `tests/` tree |

Reuse ladder:

```text
Used by one feature screen?  → app/components/<feature>/
Used by 2+ features?         → app/components/ or app/components/ui/
Used by domain + app, pure?  → src/lib/
Domain-only helper?          → that domain folder
```

## Component folders

Every non-`ui/` component lives in its own kebab-case folder with an `index.ts` barrel (same rule as coa-erp-portal shared components):

```text
src/app/components/<component-name>/
├── index.ts                 # export { ComponentName } from './component-name'
└── component-name.tsx
```

Feature screens follow the same pattern under a feature prefix:

```text
src/app/components/connections/add-connection-screen/
├── index.ts
└── add-connection-screen.tsx
```

`src/app/components/ui/` stays flat — import primitives by file (`ui/dialog`), not folder barrels.

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
