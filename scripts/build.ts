#!/usr/bin/env bun

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outfile = join(root, 'dist', 'mongoscope')

const linuxLibc = process.env.OPENTUI_LIBC === 'musl' ? 'musl' : 'glibc'

mkdirSync(dirname(outfile), { recursive: true })

const result = await Bun.build({
  entrypoints: [join(root, 'src', 'cli', 'index.ts')],
  compile: {
    outfile,
  },
  define:
    process.platform === 'linux'
      ? {
          'process.env.OPENTUI_LIBC': JSON.stringify(linuxLibc),
        }
      : undefined,
})

if (!result.success) {
  for (const log of result.logs) {
    // oxlint-disable-next-line no-console
    console.error(log)
  }
  process.exit(1)
}

// oxlint-disable-next-line no-console
console.log(`Built ${outfile}`)
