import { type TextChunk, type TextTableContent, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useRenderer, useTerminalDimensions } from '@opentui/react'
import { useEffect, useRef, useState } from 'react'
import {
  formatBytes,
  formatIndexFlags,
  formatOps,
  formatSince,
  truncateIndexCell,
  type CollectionIndexes,
  type IndexesSnapshot,
  type IndexRow,
} from '../../../../indexes'
import { displayText } from '../../../../lib/display-text'
import {
  computeTableCapacity,
  headerCell,
  padTableRows,
  tableCell,
} from '../../../lib/text-table-content'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { whenNotEditing } from '../../../lib/when-not-editing'
import { INDEXES_FOOTER, INDEXES_SHORTCUTS, toBindings } from '../../../shortcuts'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { type Theme } from '../../../theme'
import { DataTextTable } from '../../data-text-table'
import { useFooterKeybindings } from '../../footer-keybindings'

type IndexesDashboardProps = {
  snapshot: IndexesSnapshot | undefined
  isPending: boolean
}

type FlatIndexRow = {
  id: string
  collection: string
  index: IndexRow
  usageUnavailable: boolean
  collectionError: string | null
}

const EMPTY_DATABASES: string[] = []
const EMPTY_COLLECTIONS: CollectionIndexes[] = []
const EMPTY_ERRORS: IndexesSnapshot['errors'] = { databases: null, collections: null }

/** Tab bar, footer, DbSelector, title, DB chips, notes, table chrome. */
const INDEXES_CHROME_ROWS = 16

export function IndexesDashboard({ snapshot, isPending }: IndexesDashboardProps) {
  const theme = useTheme((s) => s.theme)
  const renderer = useRenderer()
  const notEditing = whenNotEditing(renderer)
  const { height: terminalHeight } = useTerminalDimensions()
  const selectedDatabase = useSession((s) => s.selectedDatabase)
  const setSelectedDatabase = useSession((s) => s.setSelectedDatabase)

  const databases = snapshot?.databases ?? EMPTY_DATABASES
  const collections = snapshot?.collections ?? EMPTY_COLLECTIONS
  const errors = snapshot?.errors ?? EMPTY_ERRORS

  const rows = flattenCollectionIndexes(collections)

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [scrollOffset, setScrollOffset] = useState(0)

  const capacity = computeTableCapacity(INDEXES_CHROME_ROWS, terminalHeight)

  const databasesRef = useRef(databases)
  const rowsRef = useRef(rows)
  const selectedDatabaseRef = useRef(selectedDatabase)
  const selectedRowIdRef = useRef(selectedRowId)
  const scrollOffsetRef = useRef(scrollOffset)
  const capacityRef = useRef(capacity)

  databasesRef.current = databases
  rowsRef.current = rows
  selectedDatabaseRef.current = selectedDatabase
  selectedRowIdRef.current = selectedRowId
  scrollOffsetRef.current = scrollOffset
  capacityRef.current = capacity

  useEffect(
    function autoSelectDatabaseWhenNeeded() {
      // Avoid treating a missing/pending query result as an empty DB list — that
      // clears selection, changes the query key, and loops forever.
      if (snapshot == null) {
        return
      }

      const nextDatabases = snapshot.databases
      if (nextDatabases.length === 0) {
        if (selectedDatabase != null) {
          setSelectedDatabase(null)
        }
        return
      }

      if (selectedDatabase == null || !nextDatabases.includes(selectedDatabase)) {
        const nextDatabase = nextDatabases[0] ?? null
        if (nextDatabase !== selectedDatabase) {
          setSelectedDatabase(nextDatabase)
        }
      }
    },
    [snapshot, selectedDatabase, setSelectedDatabase],
  )

  useEffect(
    function reconcileRowSelection() {
      if (rows.length === 0) {
        setSelectedRowId(null)
        setScrollOffset(0)
        return
      }

      setSelectedRowId((current) => {
        if (current != null && rows.some((row) => row.id === current)) {
          return current
        }
        return rows[0]?.id ?? null
      })
    },
    [rows],
  )

  useEffect(
    function clampScrollOffset() {
      setScrollOffset((offset) => {
        if (rows.length === 0) {
          return 0
        }
        const maxOffset = Math.max(0, rows.length - capacity)
        return Math.min(offset, maxOffset)
      })
    },
    [capacity, rows.length],
  )

  useFooterKeybindings(INDEXES_FOOTER)

  useBindings(
    function createIndexesNavigationLayer() {
      function cycleDatabase(delta: number) {
        const list = databasesRef.current
        if (list.length === 0) {
          return
        }
        const current = selectedDatabaseRef.current
        const currentIndex = current == null ? 0 : Math.max(0, list.indexOf(current))
        const nextIndex = (currentIndex + delta + list.length) % list.length
        setSelectedDatabase(list[nextIndex] ?? null)
        setSelectedRowId(null)
        setScrollOffset(0)
      }

      function moveSelection(delta: number) {
        const currentRows = rowsRef.current
        const length = currentRows.length
        if (length === 0) {
          return
        }

        let prev = currentRows.findIndex((row) => row.id === selectedRowIdRef.current)
        if (prev < 0) {
          prev = delta > 0 ? -1 : length
        }

        const next = Math.max(0, Math.min(length - 1, prev + delta))
        const nextRow = currentRows[next]
        if (nextRow == null) {
          return
        }

        setSelectedRowId(nextRow.id)

        const cap = capacityRef.current
        const offset = scrollOffsetRef.current
        if (next < offset) {
          setScrollOffset(next)
        } else if (next >= offset + cap) {
          setScrollOffset(next - cap + 1)
        }
      }

      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: function indexesNavigationEnabled() {
          return notEditing()
        },
        commands: [
          {
            name: 'indexes.prev-database',
            run() {
              cycleDatabase(-1)
            },
          },
          {
            name: 'indexes.next-database',
            run() {
              cycleDatabase(1)
            },
          },
          {
            name: 'indexes.move-up',
            run() {
              moveSelection(-1)
            },
          },
          {
            name: 'indexes.move-down',
            run() {
              moveSelection(1)
            },
          },
        ],
        bindings: toBindings(INDEXES_SHORTCUTS),
      }
    },
    [notEditing, setSelectedDatabase],
  )

  const resolvedIndex =
    selectedRowId == null ? -1 : rows.findIndex((row) => row.id === selectedRowId)
  const visible = rows.slice(scrollOffset, scrollOffset + capacity)
  const relativeSelectedIndex =
    resolvedIndex >= scrollOffset && resolvedIndex < scrollOffset + capacity
      ? resolvedIndex - scrollOffset
      : -1

  const content = buildIndexesTableContent(visible, relativeSelectedIndex, theme, capacity)
  const usageUnavailable = collections.some((collection) => collection.usageUnavailable)
  const collectionError = collections.find((collection) => collection.error != null)?.error ?? null

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column" paddingLeft={1} paddingRight={1} gap={0}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0} paddingBottom={0}>
        <text
          content="indexes — inventory & usage"
          fg={theme.text}
          attributes={TextAttributes.BOLD}
        />
        <text
          content={displayText(isPending && snapshot == null ? 'refresh: …' : 'refresh: 5s')}
          fg={theme.textMuted}
        />
      </box>

      {errors.databases != null ? (
        <text content={displayText(errors.databases.message)} fg={theme.error} />
      ) : null}

      <box flexDirection="row" flexWrap="wrap" gap={1} flexShrink={0} paddingBottom={0}>
        <text content="DB" fg={theme.textMuted} flexShrink={0} />
        {databases.length === 0 ? (
          <text content="(none)" fg={theme.textMuted} />
        ) : (
          databases.map(function renderDatabaseChip(name) {
            const selected = name === selectedDatabase
            return (
              <text
                key={name}
                content={displayText(selected ? `[${name}]` : name)}
                fg={selected ? theme.primary : theme.textMuted}
                {...(selected ? { attributes: TextAttributes.BOLD } : {})}
              />
            )
          })
        )}
      </box>

      {errors.collections != null ? (
        <text content={displayText(errors.collections.message)} fg={theme.error} />
      ) : null}

      {collectionError != null ? (
        <text content={displayText(collectionError.message)} fg={theme.error} />
      ) : null}

      {usageUnavailable ? (
        <text content="usage n/a on some collections (needs indexStats / clusterMonitor)" fg={theme.textMuted} />
      ) : null}

      {selectedDatabase == null ? (
        <box paddingTop={1}>
          <text content="Select a database to inspect indexes." fg={theme.textMuted} />
        </box>
      ) : (
        <box flexGrow={1} flexShrink={1} flexDirection="column" gap={0}>
          <DataTextTable content={content} theme={theme} />
          {rows.length === 0 ? (
            <box flexShrink={0}>
              <text
                content={displayText(isPending ? 'Loading indexes…' : 'no indexes in this database')}
                fg={theme.textMuted}
              />
            </box>
          ) : null}
        </box>
      )}
    </box>
  )
}

function flattenCollectionIndexes(collections: CollectionIndexes[]): FlatIndexRow[] {
  const rows: FlatIndexRow[] = []
  for (const collection of collections) {
    if (collection.error != null) {
      rows.push({
        id: `${collection.name}::__error__`,
        collection: collection.name,
        index: {
          name: '—',
          keyLabel: collection.error.message,
          flags: [],
          sizeBytes: null,
          ops: null,
          since: null,
        },
        usageUnavailable: collection.usageUnavailable,
        collectionError: collection.error.message,
      })
      continue
    }

    for (const index of collection.indexes) {
      rows.push({
        id: `${collection.name}::${index.name}`,
        collection: collection.name,
        index,
        usageUnavailable: collection.usageUnavailable,
        collectionError: null,
      })
    }
  }
  return rows
}

function buildIndexesTableContent(
  rows: FlatIndexRow[],
  selectedIndex: number,
  theme: Theme,
  rowCapacity: number,
): TextTableContent {
  const header: TextChunk[][] = [
    headerCell('COLLECTION', theme),
    headerCell('INDEX', theme),
    headerCell('KEYS', theme),
    headerCell('OPTS', theme),
    headerCell('SIZE', theme),
    headerCell('OPS', theme),
    headerCell('SINCE', theme),
  ]

  const tableRows: TextTableContent = [header]

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const selected = i === selectedIndex
    tableRows.push(buildIndexTableRow(row, selected, theme))
  }

  return padTableRows(tableRows, rowCapacity)
}

function buildIndexTableRow(row: FlatIndexRow, selected: boolean, theme: Theme): TextChunk[][] {
  const collectionLabel = truncateIndexCell(row.collection, 18)
  const collectionCell = selected
    ? tableCell(`${collectionLabel} ●`, theme.primary)
    : tableCell(collectionLabel, theme.text)

  const isErrorRow = row.collectionError != null
  const nameColor = isErrorRow ? theme.error : theme.text
  const mutedOrError = isErrorRow ? theme.error : theme.textMuted

  return [
    collectionCell,
    tableCell(truncateIndexCell(row.index.name, 20), nameColor),
    tableCell(truncateIndexCell(row.index.keyLabel, 24), mutedOrError),
    tableCell(truncateIndexCell(formatIndexFlags(row.index.flags), 16), theme.textMuted),
    tableCell(formatBytes(row.index.sizeBytes), theme.textMuted),
    tableCell(formatOps(row.index.ops), theme.textMuted),
    tableCell(formatSince(row.index.since), theme.textMuted),
  ]
}
