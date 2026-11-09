## What and why

<!-- What changes, and the problem it solves. Link the issue: "Closes #123". -->

## How to test

<!-- Commands, or the keys to press in the TUI. `bun start --log-path examples/mongod.log.sample` covers static Slow Queries and Logs. -->

## Checklist

- [ ] `bun run typecheck`
- [ ] `bunx oxlint` and `bunx oxfmt --check`
- [ ] Tests added or updated, and `bunx vitest run <file>` passes
- [ ] Docs under `docs/content/docs/` updated if flags, keys, defaults, or behavior changed
- [ ] Screenshot or recording attached for visible UI changes
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] No connection strings, hostnames, or real log lines in the diff or description
