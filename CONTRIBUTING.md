# Contributing to MongoScope

Bug reports, fixes, docs edits, and feature ideas are welcome. This page covers local setup, the checks a pull request must pass, and how releases ship.

## Ways to help

| Contribution      | Where to start                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Report a bug      | [Bug report form](https://github.com/prodioslabs/mongoscope/issues/new?template=bug_report.yml)                                             |
| Suggest a feature | [Feature request form](https://github.com/prodioslabs/mongoscope/issues/new?template=feature_request.yml)                                   |
| First code change | Issues labeled [`good first issue`](https://github.com/prodioslabs/mongoscope/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) |
| Fix the docs      | MDX pages under `docs/content/docs/`                                                                                                        |
| Security issue    | Do not open an issue — see [SECURITY.md](./SECURITY.md)                                                                                     |

For larger changes (new tab, new data source, new dependency), open an issue first so the design can be agreed before you write code.

## Set up

You need [Bun](https://bun.sh) (CI uses 1.3.11). A MongoDB log file and a reachable MongoDB are optional, depending on what you change.

```bash
git clone https://github.com/prodioslabs/mongoscope.git
cd mongoscope
bun install
bun start --log-path examples/mongod.log.sample
```

`examples/mongod.log.sample` is a synthetic one-hour `mongod` log. It covers static Slow Queries (COLLSCAN, IXSCAN, IXSCAN+SORT patterns) and the Logs tab without a server. For live tabs, point at any MongoDB you control:

```bash
bun start --uri mongodb://localhost:27017
```

The TUI needs a real interactive terminal. Piped or non-TTY runs do not render.

| Script                               | Purpose                                                             |
| ------------------------------------ | ------------------------------------------------------------------- |
| `bun start`                          | Launch the TUI from source (flags pass through)                     |
| `bun link`                           | Expose `mongoscope` on `PATH` for local development                 |
| `bun run build`                      | Native-platform binary → `dist/mongoscope`                          |
| `bun run build:release`              | All five targets + archives + `checksums.txt` under `dist/release/` |
| `bun run typecheck`                  | Typecheck                                                           |
| `bunx oxlint` / `bunx oxfmt --check` | Lint / format check                                                 |
| `bun run test`                       | Vitest (full suite)                                                 |
| `bun run bench:parser`               | Parser benchmark                                                    |

## Project layout

| Path                                                                                  | Contents                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/cli/`                                                                            | Process entry and yargs flags                                |
| `src/app/`                                                                            | OpenTUI React app: screens, stores, shortcuts, theme, config |
| `src/app/shortcuts/`                                                                  | Every keybinding, footer hint, and help entry                |
| `src/parser/`                                                                         | `mongod` JSON log parsing                                    |
| `src/query-patterns/`                                                                 | Slow-query grouping by shape                                 |
| `src/connections/`                                                                    | Saved connections and credential storage                     |
| `src/live-connection/`                                                                | Shared MongoDB client for live tabs                          |
| `src/live-ops/`, `src/replication/`, `src/indexes/`, `src/profiler/`, `src/log-tail/` | Domain logic for each tab                                    |
| `src/lib/`                                                                            | Pure helpers shared across domains                           |
| `docs/`                                                                               | Documentation site (Next.js + Fumadocs)                      |
| `scripts/`                                                                            | Build, benchmark, and version-pin scripts                    |
| `install.sh`                                                                          | curl installer                                               |
| `.circleci/config.yml`                                                                | CI and release pipeline                                      |

Domain folders never import from `src/app/`. Tests live next to their source as `*.test.ts`. [AGENTS.md](./AGENTS.md) is the full style guide (for people and coding agents alike): folder placement, naming, shortcuts modules, theme tokens, and component conventions.

## Before you open a pull request

Run the same checks CI runs:

```bash
bun run typecheck
bunx oxlint
bunx oxfmt --check
bun run test
```

While iterating, run only the tests you touched:

```bash
bunx vitest run src/query-patterns/build.test.ts
```

If you changed the docs site:

```bash
cd docs
bun install
bun run types:check
```

`bun run lint` and `bun run format` rewrite files; use them to fix issues, not to check.

A few conventions reviewers look for:

- Keys are defined once in `src/app/shortcuts/<feature>.ts`, never as strings in components.
- Colors come from the theme, never raw hex or color names.
- Always use curly braces after `if` / `else`.
- Behavior changes update the matching page under `docs/content/docs/` (flags, keys, defaults, poll intervals).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(scope): subject
```

| Part    | Rule                                                                                         |
| ------- | -------------------------------------------------------------------------------------------- |
| type    | `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`, `ci`, `build`, `revert` |
| scope   | Optional short area, for example `slow-queries`, `connections`, `docs`                       |
| subject | Imperative, lowercase start, no trailing period                                              |

```text
fix(slow-queries): restore live sample-window presets
docs(installation): add windows zip steps
```

## Pull requests

- Keep one topic per pull request and link the issue it closes.
- Describe how you tested it: commands, or the keys you pressed in the TUI.
- Add a screenshot or recording for visible UI changes.
- Redact connection strings, hostnames, and real log lines from descriptions and screenshots.

## Docs site

```bash
cd docs
bun install
bun run dev
```

Pages are MDX under `docs/content/docs/`; sidebar order is `docs/content/docs/meta.json`. Writing rules are in the "Docs content writing" section of [AGENTS.md](./AGENTS.md). More detail: [docs/README.md](./docs/README.md).

## Releasing

Maintainers only.

1. Bump and commit `package.json` `"version"`.
2. Push a matching SemVer tag (`vX.Y.Z`, or `vX.Y.Z-rc.1` for a prerelease).

The release job compares the linux-amd64 binary `--version` to the tag without `v` and fails on mismatch. CircleCI builds all five platform archives, writes `checksums.txt`, and publishes to [GitHub Releases](https://github.com/prodioslabs/mongoscope/releases). Hyphenated tags are published with `--prerelease` so they never become `latest`. Requires `GITHUB_TOKEN` in CircleCI Project Settings → Environment Variables (permission to create releases on this repo).

## Code of conduct

Participation follows the [Code of conduct](./CODE_OF_CONDUCT.md).
