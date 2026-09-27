import {
  MongoClient,
  type Collection,
  type Db,
  type Document,
  type Filter,
  type MongoClientOptions,
  type Sort,
} from 'mongodb'

export const DEFAULT_CONNECT_TIMEOUT_MS = 8000

/**
 * Thin seam over the official driver. Prefer mongodb@6.x on Bun:
 * mongodb@7 pulls a bson build that hits Bun's unimplemented
 * `v8.isBuildingSnapshot` at import time (Bun 1.3.x).
 *
 * Note: bson `Document` is `{ [key: string]: any }` — we keep the public seam on
 * `Record<string, unknown>` / `unknown` and only bridge at the adapter edge.
 */
export type AggregateCursorLike = {
  toArray(): Promise<unknown[]>
}

export type FindCursorLike = {
  sort(sort: Sort): FindCursorLike
  limit(n: number): FindCursorLike
  toArray(): Promise<unknown[]>
}

export type CollectionLike = {
  find(filter?: Record<string, unknown>): FindCursorLike
  indexes(): Promise<unknown[]>
  aggregate(pipeline: Record<string, unknown>[]): AggregateCursorLike
}

export type MongoDbLike = {
  admin(): {
    command(command: Record<string, unknown>): Promise<unknown>
  }
  command(command: Record<string, unknown>): Promise<unknown>
  aggregate(pipeline: Record<string, unknown>[]): AggregateCursorLike
  collection(name: string): CollectionLike
}

export type MongoClientLike = {
  connect(): Promise<void>
  close(force?: boolean): Promise<void>
  db(dbName?: string): MongoDbLike
  on?(event: 'close', listener: () => void): void
  off?(event: 'close', listener: () => void): void
}

/** Client seam that can open databases (`db()`). Shared by feature fetchers. */
export type MongoDbClient = Pick<MongoClientLike, 'db'>

export type CreateMongoClient = (uri: string, options: MongoClientOptions) => MongoClientLike

export function defaultCreateMongoClient(
  uri: string,
  options: MongoClientOptions,
): MongoClientLike {
  const client = new MongoClient(uri, options)
  return {
    connect: async () => {
      await client.connect()
    },
    close: (force) => client.close(force),
    db: (dbName) => adaptDb(client.db(dbName)),
    on: (event, listener) => {
      client.on(event, listener)
    },
    off: (event, listener) => {
      client.off(event, listener)
    },
  }
}

export function buildConnectOptions(connectTimeoutMs: number): MongoClientOptions {
  return {
    serverSelectionTimeoutMS: connectTimeoutMs,
    connectTimeoutMS: connectTimeoutMs,
  }
}

function adaptDb(db: Db): MongoDbLike {
  return {
    admin: () => ({
      command: (command) => db.admin().command(asDriverDocument(command)),
    }),
    command: (command) => db.command(asDriverDocument(command)),
    aggregate: (pipeline) => adaptAggregateCursor(db.aggregate(pipeline.map(asDriverDocument))),
    collection: (name) => adaptCollection(db.collection(name)),
  }
}

function adaptCollection(collection: Collection): CollectionLike {
  return {
    find: (filter) => adaptFindCursor(collection.find(asDriverFilter(filter))),
    indexes: () => collection.indexes(),
    aggregate: (pipeline) =>
      adaptAggregateCursor(collection.aggregate(pipeline.map(asDriverDocument))),
  }
}

function adaptFindCursor(cursor: {
  sort(sort: Sort): typeof cursor
  limit(n: number): typeof cursor
  toArray(): Promise<Document[]>
}): FindCursorLike {
  return {
    sort: (sort) => adaptFindCursor(cursor.sort(sort)),
    limit: (n) => adaptFindCursor(cursor.limit(n)),
    toArray: () => cursor.toArray(),
  }
}

function adaptAggregateCursor(cursor: { toArray(): Promise<Document[]> }): AggregateCursorLike {
  return {
    toArray: () => cursor.toArray(),
  }
}

/** Bridge only: driver typings use bson Document (`any` values). */
function asDriverDocument(command: Record<string, unknown>): Document {
  return command as Document
}

function asDriverFilter(filter: Record<string, unknown> | undefined): Filter<Document> {
  return (filter ?? {}) as Filter<Document>
}
