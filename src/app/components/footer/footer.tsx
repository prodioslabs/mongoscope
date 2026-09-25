import { bold, fg, StyledText, type RGBA, type TextChunk } from '@opentui/core'
import { useEffect, useState } from 'react'
import { renderMnemonicLabel, renderMnemonicSegments } from '../../lib/mnemonic-label'
import { useFooter, type FooterKeybinding } from '../../stores/footer'
import { useTheme } from '../../stores/theme'

/** Cap mid-footer status so long log paths don't crowd keybindings on narrow terminals. */
const STATUS_MAX_WIDTH = '45%'

/** Cap keybinding scope hints so they stay visible alongside clock + status. */
const SCOPE_MAX_WIDTH = '50%'

function formatClock(date: Date): string {
  const time = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(date)
  const zone = parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
  return zone ? `${time} ${zone}` : time
}

export function Footer() {
  const theme = useTheme((s) => s.theme)
  const keybindings = useFooter((s) => s.keybindings)
  const status = useFooter((s) => s.status)
  const overlayActive = useFooter((s) => s.overlays.length > 0)
  const [clock, setClock] = useState(() => formatClock(new Date()))

  useEffect(function tickClock() {
    const id = setInterval(() => {
      setClock(formatClock(new Date()))
    }, 1000)
    return function clearClock() {
      clearInterval(id)
    }
  }, [])

  return (
    <box
      width="100%"
      paddingLeft={1}
      paddingRight={1}
      paddingBottom={0}
      flexDirection="row"
      gap={2}
      backgroundColor={theme.backgroundPanel}
    >
      <text content={clock} fg={theme.text} flexShrink={0} />
      {!overlayActive ? (
        <text
          content={status ?? ''}
          fg={theme.textMuted}
          flexGrow={1}
          flexShrink={1}
          maxWidth={STATUS_MAX_WIDTH}
          wrapMode="none"
          truncate
        />
      ) : null}
      <box
        flexDirection="row"
        gap={2}
        justifyContent="flex-end"
        flexGrow={1}
        flexShrink={overlayActive ? 0 : 1}
        maxWidth={overlayActive ? undefined : SCOPE_MAX_WIDTH}
        overflow="hidden"
      >
        {keybindings.map((binding) => (
          <text
            key={`${binding.keys}:${binding.label}`}
            fg={theme.textMuted}
            content={footerChipText(binding, theme.text)}
            flexShrink={overlayActive ? 0 : 1}
            wrapMode="none"
            truncate={!overlayActive}
          />
        ))}
      </box>
    </box>
  )
}

function footerChipText(binding: FooterKeybinding, keyColor: RGBA): StyledText {
  const label =
    binding.segments != null
      ? renderMnemonicSegments(binding.segments)
      : renderMnemonicLabel(binding.label, binding.keys)
  const chunks: TextChunk[] = [
    bold(fg(keyColor)(binding.keys)),
    { __isChunk: true, text: ' ', attributes: 0 },
    ...label.chunks,
  ]
  return new StyledText(chunks)
}
