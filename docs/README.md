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

Build from the repo root with `docs/` as the context. The build needs network access (`next/font` fetches Google Fonts).

```bash
docker build -t mongoscope-docs docs
```

Pass `NEXT_PUBLIC_SITE_URL` as a build arg so absolute metadata and OG URLs are correct in the image. When unset, production builds warn and fall back to `http://localhost:3000`:

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://example.com -t mongoscope-docs docs
```

Run:

```bash
docker run --rm -p 3000:3000 mongoscope-docs
```

Open [http://localhost:3000](http://localhost:3000). `NEXT_PUBLIC_SITE_URL` is inlined at build time for `metadataBase`; a runtime `-e` does not rewrite it.
