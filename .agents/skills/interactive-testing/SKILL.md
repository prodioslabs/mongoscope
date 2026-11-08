---
name: interactive-testing
description: >-
  Test and debug MongoScope's interactive OpenTUI in a controlled tmux
  terminal. Use for TUI behavior checks, startup smoke tests, keybinding
  verification, and release binary smoke tests.
---

# Testing MongoScope interactive mode with tmux

MongoScope is a full-screen OpenTUI app. It needs a real TTY. Piped or
non-interactive `bun start` is not a valid visual check. Use tmux (or a real
terminal pane) instead.

## Minimal smoke session

From the repo root:

```bash
tmux new-session -d -s mongoscope-test -x 120 -y 40
tmux send-keys -t mongoscope-test "bun start" Enter
sleep 2 && tmux capture-pane -t mongoscope-test -p
tmux send-keys -t mongoscope-test '?'          # help overlay
sleep 0.5 && tmux capture-pane -t mongoscope-test -p
tmux send-keys -t mongoscope-test Escape
tmux send-keys -t mongoscope-test 'q'          # quit
sleep 0.5
tmux kill-session -t mongoscope-test
```

## Useful variants

Static log parse on startup (skips the welcome log picker when the path is valid):

```bash
tmux send-keys -t mongoscope-test "bun start --log-path /absolute/path/to/mongod.log" Enter
```

Ephemeral live connect (session-only; not saved to the OS keychain):

```bash
tmux send-keys -t mongoscope-test "bun start --uri 'mongodb://127.0.0.1:27017'" Enter
```

Release / compiled binary smoke (start tmux with `-c /tmp`, use the absolute binary path):

```bash
tmux new-session -d -s mongoscope-test -c /tmp -x 120 -y 40
tmux send-keys -t mongoscope-test "/absolute/path/to/dist/mongoscope" Enter
```

Startup alone is a weak pass. Prefer: start → capture → send at least one keybinding → capture again → quit cleanly.

## Key syntax in tmux

| Want | `tmux send-keys` |
| ---- | ---------------- |
| Letter / digit | `'q'`, `'m'`, `'t'` |
| Escape | `Escape` |
| Enter | `Enter` |
| Ctrl+K (command palette) | `C-k` |
| Ctrl+C | `C-c` |
| Tab | `Tab` |

Known global shortcuts (see `src/app/shortcuts/global.ts`): `ctrl+k` palette, `?` help, `m` light/dark, `t` cycle theme, `q` quit.

## Capture and assert

- `tmux capture-pane -t mongoscope-test -p` dumps the visible screen as text.
- Re-capture after each action; OpenTUI redraws the full frame.
- If the pane is blank or stuck, check that the process is still alive (`tmux list-panes -t mongoscope-test -F '#{pane_pid}'`) and that you gave it a TTY-sized session (`-x` / `-y`).
- Always `tmux kill-session -t mongoscope-test` when finished (including on failure) so later runs do not collide.

## What not to do

- Do not pipe `bun start` / `bun bin/mongoscope` to files or other commands and treat that as a UI test.
- Do not leave detached `mongoscope-test` sessions running after the check.
- Do not invent keybindings in the test script; use the shortcuts modules / footer chips as the source of truth.
