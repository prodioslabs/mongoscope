import { bold, fg, t } from '@opentui/core'
import { useEffect, useState } from 'react'
import { useFooter } from '../stores/footer'
import { useTheme } from '../stores/theme'

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
      justifyContent="space-between"
      flexDirection="row"
      gap={2}
      backgroundColor={theme.backgroundPanel}
    >
      <text content={clock} fg={theme.text} flexShrink={0} />
      {status ? <text content={status} fg={theme.textMuted} flexGrow={1} flexShrink={1} /> : null}
      <box
        flexDirection="row"
        gap={2}
        justifyContent="flex-end"
        flexGrow={status ? 0 : 1}
        flexShrink={0}
      >
        {keybindings.map((binding) => (
          <text
            key={`${binding.keys}:${binding.label}`}
            content={t`${bold(fg(theme.text)(binding.keys))} ${fg(theme.textMuted)(binding.label)}`}
          />
        ))}
      </box>
    </box>
  )
}
