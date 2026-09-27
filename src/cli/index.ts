import { createRequire } from 'node:module'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { startCommand } from './commands/start'

const { version } = createRequire(import.meta.url)('../../package.json') as {
  version: string
}

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
