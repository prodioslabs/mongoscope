export type LiveConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'disconnected'

export type LiveConnectionDisconnectReason = 'user' | 'switch' | 'drop'

export type LiveConnectionSnapshot = {
  status: LiveConnectionStatus
  /** Profile id currently associated with this snapshot (may be set while connecting/error). */
  connectionId: string | null
  /** Always a string — never Error/undefined — safe for OpenTUI `<text content>`. */
  errorMessage: string
  generation: number
}

export const IDLE_LIVE_CONNECTION_SNAPSHOT: LiveConnectionSnapshot = {
  status: 'idle',
  connectionId: null,
  errorMessage: '',
  generation: 0,
}
