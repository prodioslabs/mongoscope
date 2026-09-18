export type IndexesPanelError = {
  kind: 'permission' | 'unavailable' | 'unknown'
  message: string
}

export type IndexOptionFlag =
  | 'unique'
  | 'sparse'
  | 'partial'
  | 'ttl'
  | 'hidden'
  | 'text'
  | '2dsphere'
  | '2d'
  | 'hashed'

export type IndexRow = {
  name: string
  keyLabel: string
  flags: IndexOptionFlag[]
  sizeBytes: number | null
  ops: number | null
  since: Date | null
  building: boolean
  buildPercent: number | null
  buildMessage: string | null
}

export type CollectionIndexes = {
  name: string
  totalIndexSizeBytes: number | null
  indexes: IndexRow[]
  /** Per-collection load error (indexes/stats failed entirely). */
  error: IndexesPanelError | null
  /** True when inventory loaded but $indexStats failed. */
  usageUnavailable: boolean
}

export type IndexesSnapshot = {
  databases: string[]
  selectedDatabase: string | null
  collections: CollectionIndexes[]
  errors: {
    databases: IndexesPanelError | null
    collections: IndexesPanelError | null
    builds: IndexesPanelError | null
  }
}
