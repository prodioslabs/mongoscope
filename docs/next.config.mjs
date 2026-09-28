import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX()
const docsRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'standalone',
  // Pin tracing to docs/ so the parent monorepo bun.lock does not nest standalone output.
  outputFileTracingRoot: docsRoot,
}

export default withMDX(config)
