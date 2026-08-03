import type { Argv, CommandModule } from 'yargs'
import { start, type AppOptions } from '../../app'

function applyOptions(args: Argv) {
  return args
    .option('log-path', {
      type: 'string',
      description: 'Path of the log file to analyze',
    })
    .option('log-dir', {
      type: 'string',
      description: 'Directory containing log files to analyze',
    })
    .option('uri', {
      type: 'string',
      description: 'MongoDB connection URI',
    })
    .option('host', {
      type: 'string',
      description: 'MongoDB host',
    })
    .option('port', {
      type: 'number',
      description: 'MongoDB port',
    })
    .option('username', {
      type: 'string',
      description: 'MongoDB username',
    })
    .option('password', {
      type: 'string',
      description: 'MongoDB password',
    })
    .option('auth-db', {
      type: 'string',
      description: 'MongoDB authentication database',
    })
}

function toAppOptions(argv: AppOptions): AppOptions {
  return {
    logPath: argv.logPath,
    logDir: argv.logDir,
    uri: argv.uri,
    host: argv.host,
    port: argv.port,
    username: argv.username,
    password: argv.password,
    authDb: argv.authDb,
  }
}

export const startCommand: CommandModule<object, AppOptions> = {
  command: '$0',
  describe: 'Start MongoScope',
  builder: (yargs) => applyOptions(yargs),
  handler: async function startApplication(argv) {
    await start(toAppOptions(argv))
  },
}
