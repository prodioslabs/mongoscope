# MongoScope Docs

**The docs site for MongoScope—browse features, shortcuts, and CLI flags in the browser.**

```bash
cd docs && bun install && bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Pages live under `/docs`. Stack: Next.js + [Fumadocs](https://fumadocs.dev).

Product install and TUI quickstart stay in the [root README](../README.md). This folder is the reference site you edit and ship.

## What’s here

| Path                | Role                                           |
| ------------------- | ---------------------------------------------- |
| `content/docs/`     | MDX pages (getting started, tabs, themes, CLI) |
| `src/`              | App Router, layouts, search, UI components     |
| `src/lib/source.ts` | Fumadocs MDX content source                    |

| Script                | Purpose                    |
| --------------------- | -------------------------- |
| `bun run dev`         | Local docs with hot reload |
| `bun run build`       | Production build           |
| `bun run start`       | Serve the production build |
| `bun run lint`        | Oxlint                     |
| `bun run format`      | Oxfmt write                |
| `bun run types:check` | Next typegen + `tsc`       |

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

Build from the repo root with `docs/` as the context:

```bash
docker build -t mongoscope-docs docs
```

Optional site URL for absolute metadata and OG links (defaults to `http://localhost:3000` when unset):

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://example.com -t mongoscope-docs docs
```

Run:

```bash
docker run --rm -p 3000:3000 -e NEXT_PUBLIC_SITE_URL=http://localhost:3000 mongoscope-docs
```

Open [http://localhost:3000](http://localhost:3000). `NEXT_PUBLIC_SITE_URL` sets `metadataBase`; pass it at build time for correct absolute URLs in the built output.
