import { createRequire } from 'node:module'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { startCommand } from './commands/start'

/**
 * Compiled binaries embed the version via Bun `define` (see scripts/build.ts).
 * Dev / bun-link falls back to package.json so the string cannot drift.
 */
function resolveCliVersion(): string {
  const embedded = process.env.MONGOSCOPE_EMBEDDED_VERSION
  if (typeof embedded === 'string' && embedded.trim() !== '') {
    return embedded.trim()
  }
  const { version } = createRequire(import.meta.url)('../../package.json') as {
    version: string
  }
  return version
}

const version = resolveCliVersion()

export async function parseCli(argv: string[] = process.argv): Promise<void> {
  await yargs(hideBin(argv))
    .scriptName('mongoscope')
    .command(startCommand)
    .help()
    .alias('help', 'h')
    .version(version)
    .alias('version', 'v')
    .strict()
    .showHelpOnFail(false)
    .fail(function reportCliError(message, error) {
      if (error != null) {
        throw error
      }
      const detail = message?.trim() || 'Unknown CLI error'
      console.error(`mongoscope: ${detail}`)
      console.error('Try `mongoscope --help` for usage.')
      process.exit(1)
    })
    .parseAsync()
}

await parseCli()
