# MongoScope Docs

**The docs site for MongoScope—browse features, shortcuts, and CLI flags in the browser.**

```bash
cd docs && bun install && bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Pages live under `/docs`. Stack: Next.js + [Fumadocs](https://fumadocs.dev).

Product install and TUI quickstart stay in the [root README](../README.md). This folder is the reference site you edit and ship.

Agent writing standards for MDX pages live in the root [AGENTS.md](../AGENTS.md) **Docs content writing** section (match existing `content/docs/` style).

## What’s here

| Path                | Role                                                           |
| ------------------- | -------------------------------------------------------------- |
| `content/docs/`     | MDX pages (getting started, tabs, indexing guide, themes, CLI) |
| `src/`              | App Router, layouts, search, UI components                     |
| `src/lib/source.ts` | Fumadocs MDX content source                                    |

| Script                   | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `bun run dev`            | Generate icon/themes, then local hot reload  |
| `bun run generate:themes`| Regenerate `tui-themes.ts` from TUI assets   |
| `bun run build`          | Production build                             |
| `bun run start`          | Serve the production build                   |
| `bun run lint`           | Oxlint                                       |
| `bun run format`         | Oxfmt write                                  |
| `bun run types:check`    | Next typegen + `tsc`                         |

## Quick Start

From the repo root:

```bash
cd docs
bun install
bun run dev
```

Edit an MDX file under `content/docs/` and refresh. Search is wired through the App Router API route.

Ship it:

```bash
bun run build
bun run start
```

## Docker

Build from the repo root with `docs/` as the context. Network is needed at build time for `next build` dependency fetches; the site uses system font stacks (no webfont download).

```bash
docker build -t mongoscope-docs docs
```

Pass `NEXT_PUBLIC_SITE_URL` as a build arg. Canonical links, Open Graph images, `sitemap.xml`, and `robots.txt` all use it, so it must be the exact public hostname (`https://mongoscope.prodioslabs.in` in production). When unset, production builds warn and fall back to `http://localhost:3000`:

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://mongoscope.prodioslabs.in -t mongoscope-docs docs
```

Run:

```bash
docker run --rm -p 3000:3000 mongoscope-docs
```

Open [http://localhost:3000](http://localhost:3000). `NEXT_PUBLIC_SITE_URL` is inlined at build time for `metadataBase`; a runtime `-e` does not rewrite it.
