import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { startCommand } from './commands/start'

export async function parseCli(argv: string[] = process.argv): Promise<void> {
  await yargs(hideBin(argv))
    .scriptName('mongoscope')
    .command(startCommand)
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .strict()
    .parseAsync()
}

await parseCli()
