import type { MongoClientLike } from '../live-connection'
import { enableErrorFromUnknown } from './permissions'
import { DEFAULT_SLOWMS, type ProfilerPanelError } from './types'

export type EnableProfilingClient = Pick<MongoClientLike, 'db'>

export type EnableProfilingResult =
  | { ok: true; slowms: number }
  | { ok: false; error: ProfilerPanelError }

/**
 * Build the profile command payload for level-1 enable (never level 2).
 */
export function buildEnableProfilingCommand(slowms: number): Record<string, number> {
  const threshold =
    typeof slowms === 'number' && Number.isFinite(slowms) && slowms >= 0
      ? Math.floor(slowms)
      : DEFAULT_SLOWMS
  return { profile: 1, slowms: threshold }
}

/**
 * Enable database profiler at level 1 with the given slowms threshold.
 */
export async function enableProfiling(
  client: EnableProfilingClient | null,
  database: string,
  slowms: number = DEFAULT_SLOWMS,
): Promise<EnableProfilingResult> {
  if (client == null) {
    return {
      ok: false,
      error: { kind: 'unknown', message: 'Not connected' },
    }
  }
  if (database.trim() === '') {
    return {
      ok: false,
      error: { kind: 'unknown', message: 'No database selected' },
    }
  }

  const command = buildEnableProfilingCommand(slowms)
  try {
    await client.db(database).command(command)
    return { ok: true, slowms: command.slowms! }
  } catch (reason) {
    return { ok: false, error: enableErrorFromUnknown(reason) }
  }
}
