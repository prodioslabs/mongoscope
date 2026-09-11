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
import { INDEXES_FOOTER } from '../../../shortcuts'
import { useSession } from '../../../stores/session'
import { useTheme } from '../../../stores/theme'
import { selectedForeground, type Theme } from '../../../theme'
import { DataTextTable } from '../../data-text-table'
import { useFooterKeybindings } from '../../footer-keybindings'

type IndexesDashboardProps = {
  snapshot: IndexesSnapshot | undefined
  isPending: boolean
}

const COLLECTION_LIST_WIDTH = 28
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

  const [selectedCollectionIndex, setSelectedCollectionIndex] = useState(0)
  const [selectedIndexName, setSelectedIndexName] = useState<string | null>(null)
  const [scrollOffset, setScrollOffset] = useState(0)

  const capacity = computeTableCapacity(INDEXES_CHROME_ROWS, terminalHeight)
  const highlightFg = selectedForeground(theme)
  const focusedCollection: CollectionIndexes | null =
    collections[selectedCollectionIndex] ?? null
  const indexRows = focusedCollection?.indexes ?? []

  const databasesRef = useRef(databases)
  const collectionsRef = useRef(collections)
  const indexRowsRef = useRef(indexRows)
  const selectedDatabaseRef = useRef(selectedDatabase)
  const selectedCollectionIndexRef = useRef(selectedCollectionIndex)
  const selectedIndexNameRef = useRef(selectedIndexName)
  const scrollOffsetRef = useRef(scrollOffset)
  const capacityRef = useRef(capacity)

  databasesRef.current = databases
  collectionsRef.current = collections
  indexRowsRef.current = indexRows
  selectedDatabaseRef.current = selectedDatabase
  selectedCollectionIndexRef.current = selectedCollectionIndex
  selectedIndexNameRef.current = selectedIndexName
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
    function clampSelectedCollectionIndex() {
      const length = collections.length
      setSelectedCollectionIndex((index) => {
        if (length === 0) {
          return 0
        }
        const nextIndex = Math.min(index, length - 1)
        return nextIndex === index ? index : nextIndex
      })
    },
    [collections.length],
  )

  useEffect(
    function reconcileIndexSelection() {
      if (indexRows.length === 0) {
        setSelectedIndexName(null)
        setScrollOffset(0)
        return
      }

      setSelectedIndexName((current) => {
        if (current != null && indexRows.some((row) => row.name === current)) {
          return current
        }
        return indexRows[0]?.name ?? null
      })
      setScrollOffset(0)
    },
    [focusedCollection?.name, indexRows.length],
  )

  useEffect(
    function clampScrollOffset() {
      setScrollOffset((offset) => {
        if (indexRows.length === 0) {
          return 0
        }
        const maxOffset = Math.max(0, indexRows.length - capacity)
        return Math.min(offset, maxOffset)
      })
    },
    [capacity, indexRows.length],
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
        setSelectedCollectionIndex(0)
        setSelectedIndexName(null)
        setScrollOffset(0)
      }

      function moveCollection(delta: number) {
        const length = collectionsRef.current.length
        if (length === 0) {
          return
        }
        setSelectedCollectionIndex((index) => {
          return (index + delta + length) % length
        })
      }

      function moveIndexSelection(delta: number) {
        const currentRows = indexRowsRef.current
        const length = currentRows.length
        if (length === 0) {
          return
        }

        let prev = currentRows.findIndex((row) => row.name === selectedIndexNameRef.current)
        if (prev < 0) {
          prev = delta > 0 ? -1 : length
        }

        const next = Math.max(0, Math.min(length - 1, prev + delta))
        const nextRow = currentRows[next]
        if (nextRow == null) {
          return
        }

        setSelectedIndexName(nextRow.name)

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
            name: 'indexes.prev-collection',
            run() {
              moveCollection(-1)
            },
          },
          {
            name: 'indexes.next-collection',
            run() {
              moveCollection(1)
            },
          },
          {
            name: 'indexes.move-up',
            run() {
              moveIndexSelection(-1)
            },
          },
          {
            name: 'indexes.move-down',
            run() {
              moveIndexSelection(1)
            },
          },
        ],
        bindings: [
          { key: 'left', cmd: 'indexes.prev-database' },
          { key: 'right', cmd: 'indexes.next-database' },
          { key: '[', cmd: 'indexes.prev-collection' },
          { key: ']', cmd: 'indexes.next-collection' },
          { key: 'up', cmd: 'indexes.move-up' },
          { key: 'k', cmd: 'indexes.move-up' },
          { key: 'down', cmd: 'indexes.move-down' },
          { key: 'j', cmd: 'indexes.move-down' },
        ],
      }
    },
    [notEditing, setSelectedDatabase],
  )

  const resolvedIndex =
    selectedIndexName == null
      ? -1
      : indexRows.findIndex((row) => row.name === selectedIndexName)
  const visible = indexRows.slice(scrollOffset, scrollOffset + capacity)
  const relativeSelectedIndex =
    resolvedIndex >= scrollOffset && resolvedIndex < scrollOffset + capacity
      ? resolvedIndex - scrollOffset
      : -1

  const tableContent = buildIndexesTableContent(
    visible,
    relativeSelectedIndex,
    theme,
    capacity,
  )

  return (
    <box flexGrow={1} flexShrink={1} flexDirection="column" paddingLeft={1} paddingRight={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
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

      <box flexDirection="row" flexWrap="wrap" gap={1} flexShrink={0}>
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

      {selectedDatabase == null ? (
        <text content="Select a database to inspect indexes." fg={theme.textMuted} />
      ) : (
        <box flexGrow={1} flexShrink={1} flexDirection="row" gap={1}>
          <box
            width={COLLECTION_LIST_WIDTH}
            flexShrink={0}
            flexDirection="column"
            border
            borderStyle="single"
            borderColor={theme.border}
            paddingLeft={1}
            paddingRight={1}
          >
            <text
              content=" collections "
              fg={theme.textMuted}
              attributes={TextAttributes.BOLD}
              flexShrink={0}
            />
            {collections.length === 0 ? (
              <text
                content={displayText(isPending ? 'Loading…' : 'No collections')}
                fg={theme.textMuted}
              />
            ) : (
              collections.map(function renderCollectionRow(collection, index) {
                const highlighted = index === selectedCollectionIndex
                return (
                  <box
                    key={collection.name}
                    flexDirection="row"
                    gap={1}
                    backgroundColor={highlighted ? theme.primary : undefined}
                  >
                    <text
                      content={displayText(collection.name)}
                      fg={highlighted ? highlightFg : theme.text}
                      flexGrow={1}
                    />
                    <text
                      content={displayText(String(collection.indexes.length))}
                      fg={highlighted ? highlightFg : theme.textMuted}
                      flexShrink={0}
                    />
                  </box>
                )
              })
            )}
          </box>

          <box flexGrow={1} flexShrink={1} flexDirection="column" gap={0}>
            <IndexTableHeader collection={focusedCollection} />
            {focusedCollection?.error != null ? (
              <text content={displayText(focusedCollection.error.message)} fg={theme.error} />
            ) : null}
            {focusedCollection?.usageUnavailable ? (
              <text
                content="usage n/a (needs indexStats / clusterMonitor)"
                fg={theme.textMuted}
              />
            ) : null}
            <DataTextTable content={tableContent} theme={theme} />
            {focusedCollection != null &&
            focusedCollection.error == null &&
            indexRows.length === 0 ? (
              <box flexShrink={0}>
                <text
                  content={displayText(isPending ? 'Loading indexes…' : 'no indexes')}
                  fg={theme.textMuted}
                />
              </box>
            ) : null}
          </box>
        </box>
      )}
    </box>
  )
}

type IndexTableHeaderProps = {
  collection: CollectionIndexes | null
}

function IndexTableHeader({ collection }: IndexTableHeaderProps) {
  const theme = useTheme((s) => s.theme)

  if (collection == null) {
    return <text content="Select a collection" fg={theme.textMuted} />
  }

  return (
    <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
      <text
        content={displayText(collection.name)}
        fg={theme.text}
        attributes={TextAttributes.BOLD}
      />
      <text
        content={displayText(
          collection.totalIndexSizeBytes == null
            ? ''
            : `total ${formatBytes(collection.totalIndexSizeBytes)}`,
        )}
        fg={theme.textMuted}
      />
    </box>
  )
}

function buildIndexesTableContent(
  rows: IndexRow[],
  selectedIndex: number,
  theme: Theme,
  rowCapacity: number,
): TextTableContent {
  const header: TextChunk[][] = [
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

function buildIndexTableRow(row: IndexRow, selected: boolean, theme: Theme): TextChunk[][] {
  const nameLabel = truncateIndexCell(row.name, 22)
  const nameCell = selected
    ? tableCell(`${nameLabel} ●`, theme.primary)
    : tableCell(nameLabel, theme.text)

  return [
    nameCell,
    tableCell(truncateIndexCell(row.keyLabel, 28), theme.text),
    tableCell(truncateIndexCell(formatIndexFlags(row.flags), 16), theme.textMuted),
    tableCell(formatBytes(row.sizeBytes), theme.textMuted),
    tableCell(formatOps(row.ops), theme.textMuted),
    tableCell(formatSince(row.since), theme.textMuted),
  ]
}
