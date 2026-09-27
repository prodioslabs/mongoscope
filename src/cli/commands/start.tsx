import { stat } from 'node:fs/promises'
import type { Argv, CommandModule } from 'yargs'
import { start, type AppOptions } from '../../app'
import { resolveCliMongoUri } from '../../lib/mongodb-uri'

function applyOptions(args: Argv) {
  return args
    .option('log-path', {
      type: 'string',
      description: 'Path of the log file to analyze',
    })
    .option('log-dir', {
      type: 'string',
      default: '.',
      description: 'Directory containing log files to analyze',
    })
    .option('uri', {
      type: 'string',
      description: 'MongoDB connection URI (session-only; not saved to keychain)',
    })
    .option('host', {
      type: 'string',
      description: 'MongoDB host (session-only; not saved to keychain)',
    })
    .option('port', {
      type: 'number',
      description: 'MongoDB port (default 27017)',
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

function reportCliStartupError(message: string): never {
  console.error(`mongoscope: ${message}`)
  console.error('Try `mongoscope --help` for usage.')
  process.exit(1)
}

async function validateLogPath(logPath: string): Promise<string> {
  const trimmed = logPath.trim()
  if (trimmed === '') {
    reportCliStartupError('--log-path must be a non-empty path')
  }
  try {
    const info = await stat(trimmed)
    if (!info.isFile()) {
      reportCliStartupError(`--log-path is not a file: ${trimmed}`)
    }
  } catch {
    reportCliStartupError(`--log-path not found: ${trimmed}`)
  }
  return trimmed
}

function toAppOptions(argv: AppOptions, resolvedUri: string | null): AppOptions {
  return {
    logPath: argv.logPath,
    logDir: argv.logDir,
    uri: resolvedUri ?? undefined,
    host: undefined,
    port: undefined,
    username: undefined,
    password: undefined,
    authDb: undefined,
  }
}

export const startCommand: CommandModule<object, AppOptions> = {
  command: '$0',
  describe: 'Start MongoScope',
  builder: (yargs) => applyOptions(yargs),
  handler: async function startApplication(argv) {
    let resolvedUri: string | null
    try {
      resolvedUri = resolveCliMongoUri({
        uri: argv.uri,
        host: argv.host,
        port: argv.port,
        username: argv.username,
        password: argv.password,
        authDb: argv.authDb,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid connection flags'
      reportCliStartupError(message)
    }

    let logPath = argv.logPath
    if (logPath != null) {
      logPath = await validateLogPath(logPath)
    }

    await start(
      toAppOptions(
        {
          ...argv,
          logPath,
        },
        resolvedUri,
      ),
    )
  },
}
