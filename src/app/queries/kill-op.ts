import { useMutation } from '@tanstack/react-query'
import { killCurrentOp, parseKillOpid } from '../../live-ops'
import { liveConnectionManager } from '../../live-connection'

export function useKillCurrentOp() {
  return useMutation({
    mutationFn: async function executeKill(opid: string) {
      const numericOpid = parseKillOpid(opid)
      if (numericOpid == null) {
        return {
          ok: false as const,
          reason: 'unknown' as const,
          message: 'cannot kill: missing op id',
        }
      }
      const client = liveConnectionManager.getActiveClient()
      return killCurrentOp(client, numericOpid)
    },
  })
}
