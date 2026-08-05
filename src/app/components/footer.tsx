import { bold, fg, t } from '@opentui/core'
import { useEffect, useState } from 'react'
import { useFooter } from '../stores/footer'
import { useTheme } from '../stores/theme'

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
      {status ? (
        <text
          content={status}
          fg={theme.textMuted}
          flexGrow={1}
          flexShrink={1}
          maxWidth={STATUS_MAX_WIDTH}
          wrapMode="none"
          truncate
        />
      ) : (
        <text flexGrow={1} />
      )}
      <box
        flexDirection="row"
        gap={2}
        justifyContent="flex-end"
        flexGrow={1}
        flexShrink={1}
        maxWidth={SCOPE_MAX_WIDTH}
        overflow="hidden"
      >
        {keybindings.map((binding) => (
          <text
            key={`${binding.keys}:${binding.label}`}
            content={t`${bold(fg(theme.text)(binding.keys))} ${fg(theme.textMuted)(binding.label)}`}
            flexShrink={1}
            wrapMode="none"
            truncate
          />
        ))}
      </box>
    </box>
  )
}
