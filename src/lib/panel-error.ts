/** Shared panel failure kind used by live-ops, profiler, replication, and indexes. */
export type PanelErrorKind = 'permission' | 'unavailable' | 'unknown'

export type PanelError = {
  kind: PanelErrorKind
  message: string
}
