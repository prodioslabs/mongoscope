import { TextAttributes } from '@opentui/core'
import { useBindings } from '@opentui/keymap/react'
import { useEffect } from 'react'
import { displayText } from '../../../../lib/display-text'
import { DEFAULT_SLOWMS } from '../../../../profiler'
import { type AppKeymapMode } from '../../../lib/keymap-mode'
import { SLOW_QUERIES_ENABLE_CONFIRM_FOOTER } from '../../../shortcuts/slow-queries'
import { useFooter } from '../../../stores/footer'
import { useTheme } from '../../../stores/theme'
import { Dialog } from '../../ui/dialog'

type EnableProfilingDialogProps = {
  open: boolean
  database: string
  currentLevel: number
  currentSlowms: number
  proposedSlowms: number
  isPending: boolean
  errorMessage: string
  onConfirm: () => void
  onCancel: () => void
}

export function EnableProfilingDialog({
  open,
  database,
  currentLevel,
  currentSlowms,
  proposedSlowms,
  isPending,
  errorMessage,
  onConfirm,
  onCancel,
}: EnableProfilingDialogProps) {
  const theme = useTheme((s) => s.theme)
  const pushOverlayKeybindings = useFooter((s) => s.pushOverlayKeybindings)
  const popOverlayKeybindings = useFooter((s) => s.popOverlayKeybindings)

  useEffect(
    function syncEnableProfilingFooter() {
      if (!open) {
        return
      }
      pushOverlayKeybindings('enable-profiling-confirm', SLOW_QUERIES_ENABLE_CONFIRM_FOOTER)
      return function clearEnableProfilingFooter() {
        popOverlayKeybindings('enable-profiling-confirm')
      }
    },
    [open, popOverlayKeybindings, pushOverlayKeybindings],
  )

  useBindings(
    function createEnableProfilingLayer() {
      return {
        appMode: 'palette' satisfies AppKeymapMode,
        enabled: open && !isPending,
        priority: 50,
        commands: [
          {
            name: 'slow-queries.enable-confirm',
            run() {
              onConfirm()
            },
          },
          {
            name: 'slow-queries.enable-cancel',
            run() {
              onCancel()
            },
          },
        ],
        bindings: [
          { key: 'return', cmd: 'slow-queries.enable-confirm' },
          { key: 'enter', cmd: 'slow-queries.enable-confirm' },
          { key: 'escape', cmd: 'slow-queries.enable-cancel' },
        ],
      }
    },
    [isPending, onCancel, onConfirm, open],
  )

  if (!open) {
    return null
  }

  const slowmsLabel = Number.isFinite(proposedSlowms) ? proposedSlowms : DEFAULT_SLOWMS

  return (
    <Dialog open onClose={onCancel} width={62}>
      <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
        <text
          content="Enable database profiler?"
          fg={theme.text}
          attributes={TextAttributes.BOLD}
        />
        <text content={displayText(`database:  ${database}`)} fg={theme.textMuted} />
        <text
          content={displayText(`current:   level ${currentLevel} · slowms ${currentSlowms}`)}
          fg={theme.textMuted}
        />
        <text
          content={displayText(`will set:  level 1 · slowms ${slowmsLabel}`)}
          fg={theme.textMuted}
        />
        <text
          content="writes profiling config; brief DB lock; capped system.profile overhead"
          fg={theme.warning}
        />
        {errorMessage !== '' ? <text content={displayText(errorMessage)} fg={theme.error} /> : null}
        <text
          content={isPending ? 'enabling…' : 'enter confirm · esc cancel'}
          fg={theme.textMuted}
        />
      </box>
    </Dialog>
  )
}
