# MongoScope Docs

Fumadocs + Next.js documentation site for MongoScope.

## Develop

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Documentation lives under `/docs`.

## Build

```bash
bun run build
bun run start
```

## Layout

| Path            | Purpose                                         |
| --------------- | ----------------------------------------------- |
| `src/`          | Next.js App Router, layouts, search, components |
| `content/docs/` | MDX documentation                               |
| `lib/source.ts` | Fumadocs MDX content source (Macro API)         |
