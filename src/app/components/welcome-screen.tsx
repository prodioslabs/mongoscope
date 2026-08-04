import { RGBA, ScrollBoxRenderable, TextAttributes, type KeyEvent } from '@opentui/core'
import { useKeyboard } from '@opentui/react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { listLogFiles, MONGODB_DEFAULT_LOG_DIR } from '../lib/list-log-files'
import { useFooter } from '../stores/footer'
import { useTheme } from '../stores/theme'
import { selectedForeground } from '../theme'

const MAX_VISIBLE_FILES = 5
const MAX_SECTION_WIDTH = 80
const TRANSPARENT = RGBA.fromInts(0, 0, 0, 0)

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

type LogFileSectionProps = {
  sectionId: string
  title: string
  dir: string
  files: string[]
  active: boolean
  selectedIndex: number
  scrollRef: RefObject<ScrollBoxRenderable | null>
  onSelectIndex: (index: number) => void
}

function LogFileSection({
  sectionId,
  title,
  dir,
  files,
  active,
  selectedIndex,
  scrollRef,
  onSelectIndex,
}: LogFileSectionProps) {
  const theme = useTheme((s) => s.theme)
  const highlightFg = selectedForeground(theme)
  const needsScroll = files.length > MAX_VISIBLE_FILES
  const listHeight = Math.min(Math.max(files.length, 1), MAX_VISIBLE_FILES)

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

export function WelcomeScreen({ logDir }: WelcomeScreenProps) {
  const theme = useTheme((s) => s.theme)
  const setKeybindings = useFooter((s) => s.setKeybindings)
  const resetKeybindings = useFooter((s) => s.resetKeybindings)

  const [mongoLogs, setMongoLogs] = useState<string[]>([])
  const [dirLogs, setDirLogs] = useState<string[]>([])
  const [activeSection, setActiveSection] = useState(0)
  const [selectedIndexes, setSelectedIndexes] = useState<[number, number]>([0, 0])

  const mongoScrollRef = useRef<ScrollBoxRenderable | null>(null)
  const dirScrollRef = useRef<ScrollBoxRenderable | null>(null)

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
    function syncWelcomeFooterKeybindings() {
      setKeybindings([
        { keys: '↑/↓', label: 'navigate' },
        { keys: 'tab', label: 'section' },
      ])
      return function resetWelcomeFooterKeybindings() {
        resetKeybindings()
      }
    },
    [setKeybindings, resetKeybindings],
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

  useEffect(
    function scrollHighlightedFileIntoView() {
      const files = activeSection === 0 ? mongoLogs : dirLogs
      if (files.length <= MAX_VISIBLE_FILES) return
      const scroll = activeSection === 0 ? mongoScrollRef.current : dirScrollRef.current
      if (!scroll) return
      const sectionId = activeSection === 0 ? 'mongo' : 'log-dir'
      scroll.scrollChildIntoView(`${sectionId}-file-${selectedIndexes[activeSection]}`)
    },
    [activeSection, selectedIndexes, mongoLogs.length, dirLogs.length],
  )

  useKeyboard(function welcomeScreenKeyHandler(key: KeyEvent) {
    if (key.name === 'tab') {
      key.preventDefault()
      setActiveSection((section) => (section === 0 ? 1 : 0))
      return
    }

    if (key.name !== 'up' && key.name !== 'down') return

    const files = activeSection === 0 ? mongoLogs : dirLogs
    if (files.length === 0) return

    key.preventDefault()
    const delta = key.name === 'up' ? -1 : 1
    setSelectedIndexes((indexes) => {
      const next = [...indexes] as [number, number]
      const current = next[activeSection] ?? 0
      next[activeSection] = (current + delta + files.length) % files.length
      return next
    })
  })

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
          scrollRef={mongoScrollRef}
          onSelectIndex={(index) => {
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
          scrollRef={dirScrollRef}
          onSelectIndex={(index) => {
            setActiveSection(1)
            setSelectedIndexes((indexes) => [indexes[0], index])
          }}
        />
      </box>
    </box>
  )
}
