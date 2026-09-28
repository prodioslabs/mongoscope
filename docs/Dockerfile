# syntax=docker/dockerfile:1

# Install production dependencies without running lifecycle scripts (content is not present yet).
FROM oven/bun:1.3.11 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

# Build the Next.js standalone output (icon generation + fumadocs MDX via next config).
FROM oven/bun:1.3.11 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure public/ exists so the runner stage can copy it even when the tree is empty.
RUN mkdir -p public

# Real Node binary for next build — Bun's node shim cannot load Turbopack page-data modules.
COPY --from=node:22-bookworm-slim /usr/local/bin/node /opt/node/bin/node

ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

# Icon script needs Bun (extensionless TS). Next build must run under real Node.
RUN bun run generate:icon \
	&& /opt/node/bin/node ./node_modules/next/dist/bin/next build

# Serve the traced standalone server with Node (matches Next standalone layout).
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
	&& adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Node 22 includes fetch; no extra packages required for the probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
