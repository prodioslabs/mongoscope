/**
 * Illustrative sample data for the home page previews. Columns, keys, plans and
 * log components mirror the TUI; the numbers are made up.
 */

/** Dashboard tabs: full name, mini-terminal label, and in-tab keys shown on the home page. */
export const previewTabDefs = [
  { name: 'Slow Queries', miniLabel: '1 Slow', keys: ['c', 'a', 'p', 'x'] },
  { name: 'Live Ops', miniLabel: '2 Live', keys: ['x', 'e'] },
  { name: 'Replication', miniLabel: '3 Repl', keys: [] },
  { name: 'Indexes', miniLabel: '4 Indexes', keys: ['s', 'o', '[', ']'] },
  { name: 'Logs', miniLabel: '5 Logs', keys: ['space', '/', 'f'] },
] as const

/** Page-global shortcut rows shared by the `?` dialog (and kept aligned with the keyboard section). */
export const globalShortcutRows = [
  { id: 'help', keys: ['?'], action: 'Help' },
  { id: 'palette', keys: ['Ctrl', 'K'], action: 'Command palette' },
  { id: 'tabs', keys: ['1–5', 'Tab', '⇧Tab'], action: 'Dashboard tabs' },
  { id: 'mode', keys: ['m'], action: 'Toggle light / dark' },
  { id: 'theme', keys: ['t'], action: 'Cycle theme' },
  { id: 'quit', keys: ['q'], action: 'Quit' },
] as const

export type PlanSummary = 'COLLSCAN' | 'IXSCAN+SORT' | 'IXSCAN'

export type SlowSort = 'count' | 'avg' | 'plan'

export type SlowPattern = {
  namespace: string
  op: string
  count: number
  avgMs: number
  plan: PlanSummary
  examinedReturned: string
  filter: string
  suggestedIndex: string | null
}

export const slowPatterns: SlowPattern[] = [
  {
    namespace: 'app.orders',
    op: 'find',
    count: 1248,
    avgMs: 842,
    plan: 'COLLSCAN',
    examinedReturned: '4.2M / 12',
    filter: '{ status: "processing" }',
    suggestedIndex: '{ status: 1, createdAt: -1 }',
  },
  {
    namespace: 'app.users',
    op: 'aggregate',
    count: 386,
    avgMs: 214,
    plan: 'IXSCAN+SORT',
    examinedReturned: '98k / 386',
    filter: '$match { lastLogin: { $lt: … } } → $sort { name: 1 }',
    suggestedIndex: '{ lastLogin: 1, name: 1 }',
  },
  {
    namespace: 'app.sessions',
    op: 'update',
    count: 912,
    avgMs: 48,
    plan: 'IXSCAN',
    examinedReturned: '912 / 912',
    filter: '{ _id: … }',
    suggestedIndex: null,
  },
  {
    namespace: 'billing.invoices',
    op: 'find',
    count: 54,
    avgMs: 160,
    plan: 'IXSCAN',
    examinedReturned: '12k / 54',
    filter: '{ customerId: …, paid: false }',
    suggestedIndex: '{ customerId: 1, paid: 1 }',
  },
]

const planRank: Record<PlanSummary, number> = {
  COLLSCAN: 0,
  'IXSCAN+SORT': 1,
  IXSCAN: 2,
}

export function sortSlowPatterns(sort: SlowSort): SlowPattern[] {
  return [...slowPatterns].sort((a, b) => {
    if (sort === 'count') {
      return b.count - a.count
    }
    if (sort === 'plan') {
      return planRank[a.plan] - planRank[b.plan] || b.avgMs - a.avgMs
    }
    return b.avgMs - a.avgMs
  })
}

export type LiveOp = {
  id: number
  namespace: string
  op: string
  seconds: number
  plan: Exclude<PlanSummary, 'IXSCAN+SORT'>
  /** Ticks since the op was killed; the row lingers struck-through before it drops. */
  killedFor?: number
}

export const initialLiveOps: LiveOp[] = [
  { id: 48211, namespace: 'app.orders', op: 'find', seconds: 14, plan: 'COLLSCAN' },
  { id: 48219, namespace: 'app.users', op: 'update', seconds: 3, plan: 'IXSCAN' },
  { id: 48224, namespace: 'app.carts', op: 'aggregate', seconds: 1, plan: 'IXSCAN' },
]

export const liveOpNamespaces = [
  'app.orders',
  'app.users',
  'app.carts',
  'billing.invoices',
  'app.sessions',
]

export const liveOpKinds = ['find', 'update', 'aggregate', 'insert', 'getMore']

type ReplicaMember = {
  host: string
  state: 'PRIMARY' | 'SECONDARY'
  /** Lag range in seconds; null for the primary. */
  lagRange: readonly [number, number] | null
}

export const replicaMembers: ReplicaMember[] = [
  { host: 'rs0-a:27017', state: 'PRIMARY', lagRange: null },
  { host: 'rs0-b:27017', state: 'SECONDARY', lagRange: [0.1, 1.4] },
  { host: 'rs0-c:27017', state: 'SECONDARY', lagRange: [3, 27] },
]

export const lagHistoryLength = 48

/** Next lag sample: a bounded random walk driven by `roll` in [0, 1). */
export function nextLag(previous: number, [low, high]: readonly [number, number], roll: number) {
  const span = high - low
  const step = (roll * 2 - 1) * (span / 6.5)
  return Math.min(high, Math.max(low, previous + step))
}

/** Deterministic PRNG (mulberry32) so server and client render the same seeded history. */
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const initialLagHistory: number[][] = replicaMembers.map((member, index) => {
  if (!member.lagRange) {
    return []
  }
  const random = seededRandom(index + 7)
  const [low, high] = member.lagRange
  const samples = [(low + high) / 2]
  while (samples.length < lagHistoryLength) {
    samples.push(nextLag(samples[samples.length - 1] ?? low, member.lagRange, random()))
  }
  return samples
})

type IndexEntry = {
  name: string
  ops: number
  sizeMb: number
}

export const indexInventory: Record<string, IndexEntry[]> = {
  'app.orders': [
    { name: '_id_', ops: 2_100_000, sizeMb: 48 },
    { name: 'customerId_1', ops: 884_000, sizeMb: 31 },
    { name: 'createdAt_-1', ops: 12_400, sizeMb: 40 },
  ],
  'app.users': [
    { name: '_id_', ops: 884_000, sizeMb: 22 },
    { name: 'email_1', ops: 1_200_000, sizeMb: 31 },
    { name: 'lastLogin_1', ops: 0, sizeMb: 18 },
  ],
  'billing.invoices': [
    { name: '_id_', ops: 91_000, sizeMb: 9 },
    { name: 'customerId_1', ops: 52_000, sizeMb: 6 },
  ],
}

/** The index Slow Queries suggests for app.orders, shown building in the Indexes demo. */
export const buildingIndex = {
  collection: 'app.orders',
  name: 'status_1_createdAt_-1',
  sizeMb: 26,
} as const

export function formatOps(ops: number) {
  if (ops >= 1_000_000) {
    return `${(ops / 1_000_000).toFixed(1)}M`
  }
  if (ops >= 1_000) {
    return `${Math.round(ops / 1_000)}k`
  }
  return String(ops)
}

export type LogSeverity = 'I' | 'W' | 'E'

export type LogCategory = 'COMMAND' | 'WRITE' | 'REPL' | 'NETWORK' | 'STORAGE'

/** Category pills and their keys, as on the Logs tab. */
export const logCategories: Array<{ key: string; category: LogCategory }> = [
  { key: 'c', category: 'COMMAND' },
  { key: 'w', category: 'WRITE' },
  { key: 'r', category: 'REPL' },
  { key: 'n', category: 'NETWORK' },
  { key: 's', category: 'STORAGE' },
]

export type LogTemplate = {
  severity: LogSeverity
  category: LogCategory
  message: string
}

export const logTemplates: LogTemplate[] = [
  {
    severity: 'I',
    category: 'NETWORK',
    message: 'Connection accepted from 10.0.4.21:52144 (38 open)',
  },
  { severity: 'W', category: 'COMMAND', message: 'Slow query app.orders find 842ms COLLSCAN' },
  { severity: 'I', category: 'STORAGE', message: 'WiredTiger checkpoint complete in 1.2s' },
  { severity: 'W', category: 'REPL', message: 'rs0-c:27017 is 18s behind the primary' },
  {
    severity: 'I',
    category: 'WRITE',
    message: 'Slow update app.sessions 48ms keysExamined: 1 docsExamined: 1',
  },
  { severity: 'I', category: 'COMMAND', message: 'Slow query app.users aggregate 214ms IXSCAN' },
  {
    severity: 'I',
    category: 'STORAGE',
    message: 'Index build status_1_createdAt_-1 on app.orders: 1.1M docs scanned',
  },
  { severity: 'I', category: 'NETWORK', message: 'Connection ended 10.0.4.9:50112 (37 open)' },
  {
    severity: 'W',
    category: 'WRITE',
    message: 'Slow insert billing.invoices 312ms writeConflicts: 2',
  },
  { severity: 'I', category: 'REPL', message: 'Heartbeat to rs0-b:27017 ok · 1ms' },
  {
    severity: 'E',
    category: 'NETWORK',
    message: 'Error receiving request from client: connection reset by peer',
  },
  { severity: 'I', category: 'COMMAND', message: 'command admin.$cmd { ping: 1 } 0ms' },
]

export function formatClock(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600) % 24
  const minutes = Math.floor(totalSeconds / 60) % 60
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}
