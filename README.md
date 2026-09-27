# MongoScope

**See which MongoDB queries are killing your latency—without leaving the terminal.**

```bash
curl -fsSL https://raw.githubusercontent.com/prodioslabs/mongoscope/main/install.sh | bash
```

Then run `mongoscope`. Pick a log file. Hit Enter. You get slow-query patterns, live ops, replica lag, indexes, and log tails in one keyboard-driven TUI.

Built with [Bun](https://bun.sh) and [OpenTUI](https://github.com/anomalyco/opentui). Needs a real interactive TTY (don't pipe stdout).

Linux (amd64 / arm64) and macOS (Intel / Apple Silicon). Windows binaries are attached to [GitHub Releases](https://github.com/prodioslabs/mongoscope/releases) (the curl installer is Unix-only, same as Cellar).

## What you get

| Area         | What it surfaces                                                |
| ------------ | --------------------------------------------------------------- |
| Slow Queries | Aggregated patterns from logs, or live `system.profile` samples |
| Live Ops     | `currentOp`, COLLSCAN highlights, kill-op, collection `top`     |
| Replication  | Topology, oplog window, lag sparkline, heartbeats, elections    |
| Indexes      | Inventory, build %, `$indexStats`, jump from a slow query       |
| Logs         | File tail or rolling `getLog` buffer from a live connection     |

Connections land in your OS keychain (`Bun.secrets`). Themes (gruvbox, catppuccin, nord, …) persist under `~/.config/mongoscope/`.

## Install options

| Method                 | Command / notes                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| **curl (recommended)** | `curl -fsSL https://raw.githubusercontent.com/prodioslabs/mongoscope/main/install.sh \| bash` |
| Pin a version          | `MONGOSCOPE_VERSION=v0.1.0 curl -fsSL … \| bash`                                              |
| Custom prefix          | `MONGOSCOPE_PREFIX=$HOME/.local curl -fsSL … \| bash`                                         |

The installer downloads the matching archive from GitHub Releases, verifies `checksums.txt`, installs to `/usr/local/bin` (Linux) or `~/.local/bin` (macOS), and runs `mongoscope --version`.

## For contributors

Needs [Bun](https://bun.sh). Optional: a MongoDB log and/or a reachable instance.

```bash
git clone https://github.com/prodioslabs/mongoscope.git
cd mongoscope
bun install
bun start
```

For a global `mongoscope` during development (script entry — requires Bun on PATH):

```bash
bun link
mongoscope --help
```

That is separate from release binaries:

| Script                               | Purpose                                                             |
| ------------------------------------ | ------------------------------------------------------------------- |
| `bun start`                          | Launch the TUI from source                                          |
| `bun link`                           | Expose `mongoscope` on PATH for local dev                           |
| `bun run build`                      | Native-platform binary → `dist/mongoscope`                          |
| `bun run build:release`              | All five targets + archives + `checksums.txt` under `dist/release/` |
| `bun run typecheck`                  | Typecheck                                                           |
| `bunx oxlint` / `bunx oxfmt --check` | Lint / format check                                                 |
| `bun run test`                       | Vitest                                                              |

On the welcome screen, pick a log from `/var/log/mongodb` or your `--log-dir` (default `.`). Enter parses the last 100k lines and opens the dashboard.

If a log directory (or selected file) is unreadable due to permissions, Welcome shows a permission error and offers **retry with sudo** (`r`). Confirming runs a short-lived elevated `ls` / `tail` — the app itself does **not** run as root — and your password may be requested. Elevation is scoped to Welcome log listing and file read only (not live connect, secrets, kill-op, profiler, or config). `sudo` is optional: without it the app still runs, but protected directories stay inaccessible.

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

## CLI flags

```bash
mongoscope --help
# or: bun start --help
```

| Flag                                                        | Status                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `-h`, `--help` / `-v`, `--version`                          | Print and exit immediately (`package.json` in dev; `MONGOSCOPE_EMBEDDED_VERSION` in release binaries) |
| `--log-dir`                                                 | Welcome screen’s second log list (default `.`)                                                        |
| `--log-path`                                                | Parse that log file on startup (skips picker; invalid path exits 1)                                   |
| `--uri`                                                     | Ephemeral live connect for this session (not saved to keychain)                                       |
| `--host`, `--port`, `--username`, `--password`, `--auth-db` | Build a URI and ephemeral-connect (do not combine with `--uri`; default port 27017)                   |
