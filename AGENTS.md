# Agent guidelines

## Conversational style

- Keep answers short, direct, and technical. No fluff or cheerful filler (e.g. "Thanks @user" not "Thanks so much @user!").
- No emojis in commits, issues, PR comments, or code.
- Use simple language; define unavoidable jargon before using it.
- Explain non-trivial designs as: problem → concrete example or short trace → solution. State why the solution is necessary vs optional complexity. Prefer concrete behavior over abstract summaries or unexplained change lists.
- Answer questions before making edits or running implementation commands.
- On user feedback or analysis: say agree or disagree before saying what you changed.

## Commit messages

Always use Commitizen / Conventional Commits (unless the user asks for a different format):

```text
type(scope): subject
```

- **type**: `feat` | `fix` | `refactor` | `chore` | `docs` | `test` | `style` | `perf` | `ci` | `build` | `revert`
- **scope**: optional but preferred — short area (e.g. `connections`, `slow-queries`, `docs`)
- **subject**: imperative, lowercase start, no trailing period, concise why/what

```text
# ❌ BAD
Extract FormPreviewExtraFieldProps to break form-preview import cycles.
Fixed the uploader thing
WIP

# ✅ GOOD
refactor(connections): extract credential store helpers to break import cycles
fix(slow-queries): restore live sample-window presets
chore(docs): clarify ephemeral CLI connect in getting started
```

## Code quality

- Read files in full before wide-ranging changes, before editing files you have not fully inspected, and when asked to investigate or audit. Do not rely on search snippets for broad changes.
- No `any` unless absolutely necessary.
- Check `node_modules` for external API types; don't guess.
- No inline imports (`await import()`, `import("pkg").Type`, dynamic type imports). Top-level imports only.
- Never remove or downgrade code to fix type errors from outdated deps; upgrade the dep instead.
- Always ask before removing functionality or code that appears intentional.
- Do not preserve backward compatibility unless the user asks for it.

## Code conventions

### Mandatory curly braces

Always use curly braces after `if` and `else`, even for single-line bodies.

```typescript
// ❌ BAD
if (isValid) return true
else return false

// ✅ GOOD
if (isValid) {
  return true
} else {
  return false
}
```

### Descriptive naming

Names for files, variables, and functions must be developer-friendly and descriptive. Avoid cryptic abbreviations. File names should reflect their primary export or purpose. Function and variable names should describe intent, not implementation details.

```typescript
// ❌ BAD
// File: connSvc.ts
const d = getData()
function proc(x: Connection) {
  /* ... */
}

// ✅ GOOD
// File: connection-store.ts
const savedConnections = listSavedConnections()
function activateConnection(connection: Connection) {
  /* ... */
}
```

### No hardcoded colors

Never hardcode raw color values (hex codes, `"red"`, `"yellow"`, `"blue"`, etc.) in TUI or themed UI. Use theme / token APIs already in the app; add a token there first if one is missing. Docs site exception: see [Docs site exemption](#docs-site-exemption) for fixed OS-brand color identifiers that are not themeable UI tokens.

```tsx
// ❌ BAD
<box backgroundColor="#1a73e8" />
<span style={{ color: 'red' }} />

// ✅ GOOD
<box backgroundColor={theme.primary} />
<span className="text-destructive" />
```

### Prefer the existing dynamic source

When a value already varies by record and is stored on that record, read it from there. Do not hardcode a one-off for the same format.

```typescript
// ❌ BAD — connection.displayName already exists
const label = `${connection.host}:${connection.port}`

// ✅ GOOD
const label = connection.displayName
```

### Prefer `satisfies` over `as`

Use `satisfies` to check a value against a type while keeping the inferred shape. Use `as` only to intentionally override inference (e.g. after a runtime check TypeScript cannot see).

```typescript
type RGB = [number, number, number]
type Color = string | RGB

// ❌ BAD — `as` widens and loses specifics
const a = {
  red: [255, 0, 0],
  green: '#00ff00',
} as Record<string, Color>

a.green.toUpperCase() // error: might be an RGB tuple

// ✅ GOOD
const b = {
  red: [255, 0, 0],
  green: '#00ff00',
} satisfies Record<string, Color>

b.green.toUpperCase() // string
b.red.map((n) => n / 255) // tuple
```

## Folder placement

Put code next to its only consumer; promote on a second real consumer. Domain stays outside `app/`; React/OpenTUI stays inside `app/`.

| Kind of code                                                 | Where it goes                                                                                                                                                 | Must not                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Domain logic (pure, no OpenTUI)                              | Top-level `src/<domain>/` — today: `connections`, `parser`, `query-patterns`, `indexes`, `live-ops`, `live-connection`, `log-tail`, `profiler`, `replication` | Import from `app/`              |
| Domain types                                                 | Colocated `types.ts` in that domain folder (e.g. `src/connections/types.ts`)                                                                                  | Central `lib/types.ts` dump     |
| Cross-domain pure utils                                      | `src/lib/` by concern                                                                                                                                         | Import domain modules           |
| OpenTUI shell, screens, stores, shortcuts, theme, app config | `src/app/`                                                                                                                                                    | Own domain business rules       |
| TUI-only helpers                                             | `src/app/lib/`                                                                                                                                                | Live in `src/lib/`              |
| React Query / UI data hooks                                  | `src/app/queries/`                                                                                                                                            | Sit at top-level `src/queries/` |
| Feature screens + feature-private presentation               | `src/app/components/<feature>/<name>/`                                                                                                                        | Premature extract to shared     |
| Shared widgets / primitives (2+ features)                    | `src/app/components/<name>/` or `ui/`                                                                                                                         | Feature-private helpers         |
| Process entry (yargs)                                        | `src/cli/`                                                                                                                                                    | App UI                          |
| Tests                                                        | Colocated `*.test.ts` next to source                                                                                                                          | Separate `tests/` tree          |

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
src/app/components/connections/connections-dialog/
├── index.ts
└── connections-dialog.tsx
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

## Docs site exemption

`docs/` is a separate Next.js / Fumadocs site. It is **exempt** from the TUI-authored component-folder, props-destructure, and named-`useEffect` rules above — those target React/OpenTUI under `src/app/`. Docs follows framework-native conventions instead: default exports for Next-generated layout/page props, flat route-private `_components/`, and Tailwind (including fixed OS-brand color identifiers where those colors are not themeable UI tokens). Shared docs widgets under `docs/src/components/` may still use kebab folders + barrels when that fits, but that is optional style for the docs package, not the TUI reuse ladder.

## Docs content writing

When creating or editing product documentation under `docs/content/docs/` (or the root/docs READMEs), follow the **developer-documentation** skill:

- Skill: `.agents/skills/developer-documentation/SKILL.md`
- Page types: `.agents/skills/developer-documentation/references/documentation-types.md`
- Writing standard: `.agents/skills/developer-documentation/references/writing-standard.md`

Choose the page type by the reader's job, verify claims against the CLI/TUI, and keep `docs/content/docs/meta.json` in sync with the sidebar.

## Cursor Cloud specific instructions

MongoScope is a single-package **terminal UI (TUI)** CLI for visualizing MongoDB logs. It has no HTTP server or network port. The toolchain is [Bun](https://bun.sh) (runtime + package manager); Bun lives at `~/.bun/bin` and is on `PATH` via `~/.bashrc`. All commands are defined in `package.json` `scripts`.

Non-obvious caveats for running/testing:

- `bun start` (alias for `bun bin/mongoscope`) renders a full-screen OpenTUI interface and **requires a real interactive TTY**. It will not render correctly if stdout is piped or run non-interactively; test it from an actual terminal (e.g. the Desktop pane). Key bindings: `Ctrl+K` command palette, `m` toggle light/dark, `t` cycle themes, `q` quit.
- `--uri` / `--host` / `--port` (and related creds) resolve to a **session-only ephemeral live connect** (not saved to the OS keychain). `--log-path` parses that log file on startup (static Slow Queries / Logs). Live tabs need a reachable MongoDB; static log analysis does not.
- `bun run test` runs Vitest against colocated `*.test.ts` files next to their source (see folder placement table). Prefer `bun run test` for the full suite.
- The `lint` and `format` scripts mutate files (`oxlint --fix`, `oxfmt --write`). For check-only runs use `bunx oxlint` and `bunx oxfmt --check`.
- `bun run build` compiles a standalone binary to `dist/mongoscope` (~110MB, gitignored).
