# MongoScope

Terminal UI for inspecting MongoDB slow queries, live operations, replication, indexes, and logs. Built with [Bun](https://bun.sh) and [OpenTUI](https://github.com/anomalyco/opentui).

Deeper reference: [`docs/`](./docs) (`cd docs && bun install && bun run dev`).

Requires a real interactive TTY (`bun start` will not render correctly if stdout is piped).

## Prerequisites

- **Bun** (runtime + package manager)
- **OS credential store** for saved connections (`Bun.secrets`):
  - macOS: Keychain
  - Linux: Secret Service (GNOME Keyring, KWallet, etc.)
- Optional: a MongoDB log file to analyze, and/or a reachable MongoDB instance for live tabs

## Install & run

```bash
bun install
bun start
```

Useful scripts:

| Script | Purpose |
| --- | --- |
| `bun start` | Launch the TUI |
| `bun run typecheck` | Typecheck |
| `bunx oxlint` / `bunx oxfmt --check` | Lint / format check (non-mutating) |
| `bun run test` | Vitest |
| `bun run build` | Standalone binary → `dist/mongoscope` |

## Getting started

1. **Welcome** — pick a MongoDB log from `/var/log/mongodb` or `--log-dir` (default `.`), then Enter to parse the last **100k** lines and open the dashboard.
2. **Dashboard tabs** (`1`–`5`, or Tab / Shift+Tab): Slow Queries · Live Ops · Replication · Indexes · Logs.
3. **Connections** — press `c` on Live Ops / Replication / Indexes (or Ctrl+K → Manage connections). With no saved profiles, those tabs show an inline add form. URIs are stored in the OS keychain under service `com.mongoscope.cli`.
4. After a connection is selected, Slow Queries and Logs can toggle **Static** vs **Live** with `l`.

There is no separate full-screen connections flow — switching, adding, editing, and deleting happen through **DbSelector** + the connections dialog.

Global keys: `?` help · `Ctrl+K` command palette · `m` light/dark · `t` cycle theme · `q` quit.

## Features

### Slow Queries

- **Static (default):** aggregates slow-query patterns from the parsed log file.
- **Live:** reads newest `system.profile` samples from the selected connection (poll ~2s). Toggle with `l` when a connection is selected.
- Live requires profiling on the selected database: press `e` → confirm dialog (sets profiler level 1 + `slowms`, default 100).
- Sort: `c` count · `a` avg ms · `p` plan. Details: Enter. From details, `i` jumps to Indexes with a suggested vs existing index (read-only).
- Live sample window: `Shift+T` (presets / custom). Cycle databases: `[` / `]`.

### Live Ops

Requires a selected live connection. Polls ~1s.

- `currentOp` table (active & queued), plan column with **COLLSCAN** highlighted as error severity
- Collection top chart (read/write time from `top`)
- Sidebar: connections, queued ops, lock waits
- `x` → confirm kill op · `e` → jump to matching Slow Queries detail/explain when a pattern matches

### Replication

Requires a selected live connection. Auto-refresh ~5s.

- Replica-set **topology** (members, lag, priority/votes)
- **Oplog window** (size, fill, growth)
- **Lag trend** sparkline (session samples since connect, ~10m window, no backfill)
- **Heartbeats** (ping edges from this node)
- **Recent elections / state changes** from server `getLog` RAM buffer (not a fixed multi-day history)
- Default **write concern** (majority wait is not exposed read-only → shown as n/a)

### Indexes

Requires a selected live connection. Auto-refresh ~5s.

- Per-database / collection inventory, sizes, flags, `$indexStats` ops/since (connected node only)
- In-progress **BUILD %** from `$currentOp` (idleConnections included)
- Navigation: `←`/`→` database · `[`/`]` collection · `↑`/`↓` rows
- Sort: `n`/`i` collections · `s`/`o` indexes by size/ops
- Jump target from Slow Queries details (`i`) with suggested-index banner (create outside MongoScope)

### Logs

- **Static:** live-tail of the analyzed log file (after welcome parse).
- **Live:** polls `getLog: 'global'` from the selected connection. Toggle with `l` when connected.
- Live fidelity: **rolling RAM buffer (~1024 events)** — not a durable full history (banner in UI).
- `space` follow · `/` search · `f` custom filter · `c`/`w`/`r`/`n`/`s` category pills

### Themes

- Built-ins (e.g. gruvbox default, catppuccin, nord, tokyonight, …) plus optional user themes.
- Theme name + light/dark mode persisted in `~/.config/mongoscope/config.json` (or `$XDG_CONFIG_HOME/mongoscope/config.json`).
- Drop `*.json` theme files in `~/.config/mongoscope/themes/` (basename = theme name; user overrides built-in of the same name).
- `t` cycles themes · `m` toggles light/dark · Ctrl+K → Switch theme.

## CLI flags

```bash
bun start --help
```

| Flag | Status |
| --- | --- |
| `--log-dir` | **Wired** — welcome screen’s second log list (default `.`) |
| `--log-path`, `--uri`, `--host`, `--port`, `--username`, `--password`, `--auth-db` | Parsed by yargs but **not wired** into the app yet — use the welcome picker and in-app connections dialog |

## Keyboard shortcuts

Press `?` in the app for the full, up-to-date list (sourced from `src/app/shortcuts/`).
