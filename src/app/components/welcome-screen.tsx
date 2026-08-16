import { RGBA, ScrollBoxRenderable, TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { join } from 'node:path'
import { useEffect, useRef, useState } from 'react'
import { listLogFiles, MONGODB_DEFAULT_LOG_DIR } from '../lib/list-log-files'
import { type AppKeymapMode } from '../lib/keymap-mode'
import { toBindings, toFooter, WELCOME_PARSING_FOOTER, WELCOME_SHORTCUTS } from '../shortcuts'
import { useFooterKeybindings } from './footer-keybindings'
import { useSession } from '../stores/session'
import { useTheme } from '../stores/theme'
import { selectedForeground } from '../theme'

const MAX_VISIBLE_FILES = 5
const MAX_SECTION_WIDTH = 80
const PROGRESS_BAR_WIDTH = 24
const TRANSPARENT = RGBA.fromInts(0, 0, 0, 0)

const WELCOME_IDLE_KEYBINDINGS = toFooter(WELCOME_SHORTCUTS)

// Original "scope" mark: a monitor screen with a pulse waveform.
const SCOPE = [
  '  ▄███████████▄  ',
  '  █           █  ',
  '  █    ▄█▄    █  ',
  '  █ ▄▄▄█ █▄▄▄ █  ',
  '  █           █  ',
  '  ▀███████████▀  ',
].join('\n')

type WelcomeScreenProps = {
  logDir: string
}

export function WelcomeScreen({ logDir }: WelcomeScreenProps) {
  const theme = useTheme((s) => s.theme)
  const parseProgress = useSession((s) => s.parseProgress)
  const parseError = useSession((s) => s.parseError)
  const startParse = useSession((s) => s.startParse)
  const goToConnections = useSession((s) => s.goToConnections)
  const parsing = parseProgress !== null

  const [mongoLogs, setMongoLogs] = useState<string[]>([])
  const [dirLogs, setDirLogs] = useState<string[]>([])
  const [activeSection, setActiveSection] = useState(0)
  const [selectedIndexes, setSelectedIndexes] = useState<[number, number]>([0, 0])

  useFooterKeybindings(parsing ? WELCOME_PARSING_FOOTER : WELCOME_IDLE_KEYBINDINGS)

  useEffect(
    function loadLogFileLists() {
      let cancelled = false

      async function load() {
        const [mongo, dir] = await Promise.all([
          listLogFiles(MONGODB_DEFAULT_LOG_DIR),
          listLogFiles(logDir),
        ])
        if (cancelled) return
        setMongoLogs(mongo)
        setDirLogs(dir)
        setSelectedIndexes([0, 0])
      }

      void load()

      return function cancelLoadLogFileLists() {
        cancelled = true
      }
    },
    [logDir],
  )

  useEffect(
    function clampSelectionToFiles() {
      setSelectedIndexes(([mongoIndex, dirIndex]) => [
        mongoLogs.length === 0 ? 0 : Math.min(mongoIndex, mongoLogs.length - 1),
        dirLogs.length === 0 ? 0 : Math.min(dirIndex, dirLogs.length - 1),
      ])
    },
    [mongoLogs.length, dirLogs.length],
  )

  const activeSectionRef = useRef(activeSection)
  const selectedIndexesRef = useRef(selectedIndexes)
  const mongoLogsRef = useRef(mongoLogs)
  const dirLogsRef = useRef(dirLogs)
  const logDirRef = useRef(logDir)
  const startParseRef = useRef(startParse)
  const goToConnectionsRef = useRef(goToConnections)

  activeSectionRef.current = activeSection
  selectedIndexesRef.current = selectedIndexes
  mongoLogsRef.current = mongoLogs
  dirLogsRef.current = dirLogs
  logDirRef.current = logDir
  startParseRef.current = startParse
  goToConnectionsRef.current = goToConnections

  useBindings(
    function createWelcomeScreenLayer() {
      function logFilesForSection(section: number) {
        return section === 0 ? mongoLogsRef.current : dirLogsRef.current
      }

      function selectIndexInSection(section: number, index: number) {
        setSelectedIndexes((indexes) => {
          if (indexes[section] === index) {
            return indexes
          }
          const next = [...indexes] as [number, number]
          next[section] = index
          return next
        })
      }

      function navigateSelection(delta: number) {
        const section = activeSectionRef.current
        const files = logFilesForSection(section)
        const nextIndex = (selectedIndexesRef.current[section] ?? 0) + delta

        if (files.length > 0 && nextIndex >= 0 && nextIndex < files.length) {
          selectIndexInSection(section, nextIndex)
          return
        }

        const otherSection = 1 - section
        const otherSectionFiles = logFilesForSection(otherSection)
        setActiveSection(otherSection)
        if (otherSectionFiles.length > 0) {
          selectIndexInSection(otherSection, delta < 0 ? otherSectionFiles.length - 1 : 0)
        }
      }

      return {
        appMode: 'base' satisfies AppKeymapMode,
        enabled: !parsing,
        commands: [
          {
            name: 'welcome.analyze',
            run() {
              const section = activeSectionRef.current
              const files = logFilesForSection(section)
              const name = files[selectedIndexesRef.current[section] ?? 0]
              if (!name) {
                return
              }
              const dir = section === 0 ? MONGODB_DEFAULT_LOG_DIR : logDirRef.current
              void startParseRef.current(join(dir, name))
            },
          },
          {
            name: 'welcome.toggle-section',
            run() {
              setActiveSection((section) => 1 - section)
            },
          },
          {
            name: 'welcome.move-up',
            run() {
              navigateSelection(-1)
            },
          },
          {
            name: 'welcome.move-down',
            run() {
              navigateSelection(1)
            },
          },
          {
            name: 'welcome.open-connections',
            run() {
              goToConnectionsRef.current()
            },
          },
        ],
        bindings: toBindings(WELCOME_SHORTCUTS),
      }
    },
    [parsing],
  )

  return (
    <box
      flexGrow={1}
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      paddingTop={1}
      maxWidth={320}
      gap={0}
    >
      <box
        flexShrink={0}
        flexDirection="row"
        alignItems="center"
        justifyContent="center"
        marginBottom={2}
      >
        <text content={SCOPE} fg={theme.accent} />
        <box flexDirection="column" alignItems="flex-start">
          <ascii-font text="MongoScope" color={theme.text} />
          <text content="a lens into your MongoDB" fg={theme.textMuted} />
        </box>
      </box>
      <text content="Select a log file to analyze" fg={theme.textMuted} />
      <box
        flexDirection="column"
        paddingLeft={1}
        paddingRight={1}
        width={MAX_SECTION_WIDTH}
        maxWidth={MAX_SECTION_WIDTH}
      >
        <LogFileSection
          sectionId="mongo"
          title="MongoDB logs"
          dir={MONGODB_DEFAULT_LOG_DIR}
          files={mongoLogs}
          active={activeSection === 0}
          selectedIndex={selectedIndexes[0]}
          onSelectIndex={(index) => {
            if (parsing) return
            setActiveSection(0)
            setSelectedIndexes((indexes) => [index, indexes[1]])
          }}
        />
        <LogFileSection
          sectionId="log-dir"
          title="Log directory"
          dir={logDir}
          files={dirLogs}
          active={activeSection === 1}
          selectedIndex={selectedIndexes[1]}
          onSelectIndex={(index) => {
            if (parsing) return
            setActiveSection(1)
            setSelectedIndexes((indexes) => [indexes[0], index])
          }}
        />
        {parseProgress !== null ? (
          <box flexDirection="column" marginTop={1} gap={0}>
            <text fg={theme.textMuted}>
              Parsing… {parseProgress}% {progressBar(parseProgress)}
            </text>
          </box>
        ) : null}
        {parseError ? (
          <text fg={theme.error} marginTop={1}>
            {parseError}
          </text>
        ) : null}
      </box>
    </box>
  )
}

function progressBar(percent: number): string {
  const filled = Math.round((percent / 100) * PROGRESS_BAR_WIDTH)
  return `[${'█'.repeat(filled)}${'░'.repeat(PROGRESS_BAR_WIDTH - filled)}]`
}

type LogFileSectionProps = {
  sectionId: string
  title: string
  dir: string
  files: string[]
  active: boolean
  selectedIndex: number
  onSelectIndex: (index: number) => void
}

function LogFileSection({
  sectionId,
  title,
  dir,
  files,
  active,
  selectedIndex,
  onSelectIndex,
}: LogFileSectionProps) {
  const theme = useTheme((s) => s.theme)
  const highlightFg = selectedForeground(theme)
  const needsScroll = files.length > MAX_VISIBLE_FILES
  const listHeight = Math.min(Math.max(files.length, 1), MAX_VISIBLE_FILES)
  const scrollRef = useRef<ScrollBoxRenderable | null>(null)

  useEffect(
    function scrollHighlightedFileIntoView() {
      if (!active || !needsScroll) return
      const scroll = scrollRef.current
      if (!scroll) return
      scroll.scrollChildIntoView(`${sectionId}-file-${selectedIndex}`)
    },
    [active, needsScroll, sectionId, selectedIndex],
  )

  const rows =
    files.length > 0 ? (
      files.map((name, index) => {
        const highlighted = active && index === selectedIndex
        const fg = highlighted ? highlightFg : theme.text
        return (
          <box
            key={name}
            id={`${sectionId}-file-${index}`}
            flexDirection="row"
            gap={1}
            backgroundColor={highlighted ? theme.primary : TRANSPARENT}
            onMouseOver={() => onSelectIndex(index)}
            onMouseDown={() => onSelectIndex(index)}
            paddingLeft={1}
            paddingRight={1}
          >
            <text
              content={name}
              fg={fg}
              attributes={highlighted ? TextAttributes.BOLD : undefined}
              flexGrow={1}
            />
            <text flexShrink={0} content={highlighted ? '●' : ' '} fg={fg} />
          </box>
        )
      })
    ) : (
      <text content="No log files found" fg={theme.textMuted} />
    )

  return (
    <box
      flexShrink={0}
      flexDirection="column"
      borderStyle="single"
      borderColor={active ? theme.borderActive : theme.borderSubtle}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={active ? theme.accent : theme.textMuted}>
        {title} ({dir})
      </text>
      {needsScroll ? (
        <scrollbox
          ref={scrollRef}
          focusable={false}
          height={MAX_VISIBLE_FILES}
          backgroundColor={theme.backgroundElement}
          rootOptions={{ backgroundColor: theme.backgroundElement }}
          viewportOptions={{ backgroundColor: theme.backgroundElement }}
          contentOptions={{ backgroundColor: theme.backgroundElement }}
          scrollbarOptions={{
            trackOptions: {
              foregroundColor: theme.border,
              backgroundColor: theme.backgroundElement,
            },
          }}
        >
          {rows}
        </scrollbox>
      ) : (
        <box height={listHeight} flexDirection="column" backgroundColor={theme.backgroundElement}>
          {rows}
        </box>
      )}
    </box>
  )
}
