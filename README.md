# MongoScope

**See which MongoDB queries are killing your latency—without leaving the terminal.**

```bash
bun install && bun start
```

Pick a log file. Hit Enter. You get slow-query patterns, live ops, replica lag, indexes, and log tails in one keyboard-driven TUI.

Built with [Bun](https://bun.sh) and [OpenTUI](https://github.com/anomalyco/opentui). Needs a real interactive TTY (don't pipe stdout).

## What you get

| Area         | What it surfaces                                                |
| ------------ | --------------------------------------------------------------- |
| Slow Queries | Aggregated patterns from logs, or live `system.profile` samples |
| Live Ops     | `currentOp`, COLLSCAN highlights, kill-op, collection `top`     |
| Replication  | Topology, oplog window, lag sparkline, heartbeats, elections    |
| Indexes      | Inventory, build %, `$indexStats`, jump from a slow query       |
| Logs         | File tail or rolling `getLog` buffer from a live connection     |

Connections land in your OS keychain (`Bun.secrets`). Themes (gruvbox, catppuccin, nord, …) persist under `~/.config/mongoscope/`.

## Quick Start

Needs [Bun](https://bun.sh). Optional: a MongoDB log and/or a reachable instance.

```bash
git clone https://github.com/prodioslabs/mongoscope-v2.git
cd mongoscope-v2
bun install
bun start
```

On the welcome screen, pick a log from `/var/log/mongodb` or your `--log-dir` (default `.`). Enter parses the last 100k lines and opens the dashboard.

| Key           | Action                                         |
| ------------- | ---------------------------------------------- |
| `1`–`5` / Tab | Switch tabs                                    |
| `c`           | Connections (Live Ops / Replication / Indexes) |
| `l`           | Toggle Static ↔ Live (Slow Queries / Logs)     |
| `?`           | Help                                           |
| `Ctrl+K`      | Command palette                                |
| `m` / `t`     | Light-dark / cycle theme                       |
| `q`           | Quit                                           |

Deeper reference lives in [`docs/`](./docs) — `cd docs && bun install && bun run dev`.

## Scripts

| Script                               | Purpose                               |
| ------------------------------------ | ------------------------------------- |
| `bun start`                          | Launch the TUI                        |
| `bun run typecheck`                  | Typecheck                             |
| `bunx oxlint` / `bunx oxfmt --check` | Lint / format check                   |
| `bun run test`                       | Vitest                                |
| `bun run build`                      | Standalone binary → `dist/mongoscope` |

## CLI flags

```bash
bun start --help
```

| Flag                                                                               | Status                                                                |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `--log-dir`                                                                        | Wired — welcome screen’s second log list (default `.`)                |
| `--log-path`, `--uri`, `--host`, `--port`, `--username`, `--password`, `--auth-db` | Parsed, not wired yet — use the welcome picker and in-app connections |
