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
- No runtime checks of values whose types TypeScript already guarantees (no `typeof` / `instanceof` / `Array.isArray` / shape guards on typed parameters, typed callback results, or typed declarations). Validate only at trust boundaries (CLI argv, Mongo wire input, file/config parse).
- Inline single-line helpers that have only one call site.
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

### Shortcuts and keybindings

Never hardcode key strings in handlers, footers, or help text. Define shortcuts in `src/app/shortcuts/<feature>.ts` (and `global.ts` for app-wide bindings), then wire UI through `toBindings()`, `toFooter()`, and `toHelpSection()`.

```tsx
// ❌ BAD — key string duplicated outside the shortcuts module
useBindings([{ key: 'x', cmd: 'slow-queries.export-open' }])

// ✅ GOOD — single source of truth
useBindings(toBindings(SLOW_QUERIES_SHORTCUTS))
```

Dialog chrome may bind `escape` to a close command when that is the shared overlay contract; feature actions still belong in the shortcuts modules.

## Agent skills (TUI)

Load the matching skill before non-trivial work in that area:

| Need | Skill |
| ---- | ----- |
| OpenTUI components, keymap, layout, React bindings, testing helpers | `.agents/skills/opentui/SKILL.md` |
| Smoke / debug the interactive TUI in a controlled terminal | `.agents/skills/interactive-testing/SKILL.md` |

Product docs under `docs/content/docs/` (and root / `docs/` READMEs) follow [Docs content writing](#docs-content-writing) in this file — there is no separate docs skill.

## Commands

- After code changes (not docs-only): run `bun run typecheck` and fix errors before treating the work as done. For check-only lint/format use `bunx oxlint` and `bunx oxfmt --check` (the `lint` / `format` scripts mutate files).
- Never run `bun run test` (full suite) or `bun run build` unless the user asks. Prefer a targeted Vitest run for files you touched: `bunx vitest run path/to/file.test.ts`.
- If you create or modify a test file, run that test and iterate until it passes.
- For ad-hoc scripts, write them to a temp file (e.g. `/tmp`), run, edit if needed, remove when done. Do not embed multi-line scripts in shell one-liners.
- Never commit unless the user asks.
- Do not treat piped / non-TTY `bun start` as a valid TUI check. For interactive smoke tests, follow the **interactive-testing** skill (tmux) or use a real terminal.

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

Match the style of the existing MDX under `docs/content/docs/`. Prefer editing an existing page over inventing a new form. Verify every flag, key, default, path, poll interval, and version against `src/`, `install.sh`, `--help`, and in-app shortcuts (`?`) — never from memory.

### Layout and sidebar

| Path | Role |
| ---- | ---- |
| `docs/content/docs/*.mdx` | Product pages (Fumadocs MDX) |
| `docs/content/docs/meta.json` | Sidebar order and `---Section---` dividers |
| `docs/README.md` | Docs package front door (dev / build) |
| Root `README.md` | Install + TUI quickstart (keep in sync with installation / getting-started / CLI) |

When adding, removing, or renaming a page, update `meta.json` in the same change.

Current shape (keep unless restructuring intentionally):

```text
index → installation → getting-started → connections
---Tabs--- slow-queries, live-ops, replication, indexes, logs
---Reference--- indexing-guide, themes, cli, shortcuts
```

One maintained procedure per topic — link instead of copying steps across pages.

### Page skeleton (every MDX page)

```mdx
---
title: Short page title
description: One line — reader job or what the page covers
---

Opening paragraph: who/when to use this page (imperative or “Use X to …”).

## Prerequisites   <!-- tab / how-to pages; skip on pure reference if nothing to list -->

## …sections as ## only…
```

- Frontmatter: `title` + `description` only (unless an existing page already uses more).
- Fumadocs renders `title` as H1 — **no** `#` heading in the body. Start at `##`.
- Links between docs: site paths (`/docs/installation`, `/docs/getting-started#…`), not relative filesystem paths.
- Code fences: `bash` for shell, `javascript` for mongosh/aggregation examples when needed.
- Copy-paste commands: **no** `$` prompt prefix.
- Prefer **two-column markdown tables** for keys, flags, modes, panels, and env vars. Numbered lists when order matters; bullets when it does not.
- Tone: short, direct, technical. No filler (“seamless”, “robust”, “powerful”). No emojis.
- Keys and UI labels in backticks or bold only where existing pages do (`l`, `Ctrl+K`, **Slow Queries**).

### Page roles (mirror what we already ship)

| Role | Examples | Pattern |
| ---- | -------- | ------- |
| Overview | `index.mdx` | Who it is for, tab map, requirements, “Start here” numbered path, optional `<Cards>` / `<Card>` to next pages |
| Install | `installation.mdx` | Platforms table → curl steps → verify → pin/env → archives → update/uninstall → contributors |
| Quickstart | `getting-started.mdx` | Prerequisites → numbered first success → expected result → global keys → edge cases (permissions) |
| Connections / setup | `connections.mdx` | Prerequisites → how to open UI → Static vs Live → persistence vs CLI ephemeral |
| Tab how-to | `slow-queries`, `live-ops`, `replication`, `indexes`, `logs` | Prerequisites → data source / refresh → key tables → important limits (permissions, poll interval, what the tab does **not** do) |
| Concept | `indexing-guide.mdx` | Mental model + mongosh examples; point at tab pages for MongoScope UI, do not duplicate shortcut tables |
| Reference | `cli.mdx`, `shortcuts.mdx`, `themes.mdx` | Exact flags/keys/names and defaults; `shortcuts.mdx` defers to in-app `?` as authoritative |

Root `README.md`: bold one-line opener, working install example in the first lines, two-column tables, no `$` prompts; deeper detail links into `/docs`.

### Components

Use Fumadocs `<Cards>` / `<Card>` on overview-style pages when linking a set of next steps (`index.mdx`). Do not sprinkle Cards through every tab page — tab pages stay markdown tables + procedures.

### Claims that must stay true

- CLI ephemeral connect is session-only (not keychain / `config.json`).
- Live vs Static toggle is `l` when a connection is selected (Slow Queries / Logs).
- Poll / default numbers must match code (e.g. Live Ops ~1s, Replication/Indexes ~5s, Slow Queries live ~2s, Logs static ~100ms / live getLog ~1s, profiler `slowms` default 100).
- Install examples that pin a version should match current `package.json` / latest release tag (or a clearly marked placeholder).

## User override

If the user's instructions conflict with any rule in this document, ask for explicit confirmation before overriding. Only then execute their instructions.

## Cursor Cloud specific instructions

MongoScope is a single-package **terminal UI (TUI)** CLI for visualizing MongoDB logs. It has no HTTP server or network port. The toolchain is [Bun](https://bun.sh) (runtime + package manager); Bun lives at `~/.bun/bin` and is on `PATH` via `~/.bashrc`. All commands are defined in `package.json` `scripts`.

Non-obvious caveats for running/testing:

- `bun start` (alias for `bun bin/mongoscope`) renders a full-screen OpenTUI interface and **requires a real interactive TTY**. It will not render correctly if stdout is piped or run non-interactively; test it from an actual terminal (e.g. the Desktop pane). Key bindings: `Ctrl+K` command palette, `m` toggle light/dark, `t` cycle themes, `q` quit.
- `--uri` / `--host` / `--port` (and related creds) resolve to a **session-only ephemeral live connect** (not saved to the OS keychain). `--log-path` parses that log file on startup (static Slow Queries / Logs). Live tabs need a reachable MongoDB; static log analysis does not.
- `bun run test` runs Vitest against colocated `*.test.ts` files next to their source (see folder placement table). Prefer `bun run test` for the full suite.
- The `lint` and `format` scripts mutate files (`oxlint --fix`, `oxfmt --write`). For check-only runs use `bunx oxlint` and `bunx oxfmt --check`.
- `bun run build` compiles a standalone binary to `dist/mongoscope` (~110MB, gitignored).
