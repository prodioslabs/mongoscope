'use client'

import Link from 'next/link'
import { useEffect, useRef, type ReactNode } from 'react'
import { docsRoute } from '@/lib/shared'
import { Kbd } from './kbd'

const globalShortcuts: Array<{ keys: ReactNode; action: string }> = [
  { keys: <Kbd>?</Kbd>, action: 'Help' },
  {
    keys: (
      <>
        <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>
      </>
    ),
    action: 'Command palette (searches the docs here)',
  },
  {
    keys: (
      <>
        <Kbd>1</Kbd>–<Kbd>5</Kbd> · <Kbd>Tab</Kbd>
      </>
    ),
    action: 'Dashboard tabs',
  },
  { keys: <Kbd>m</Kbd>, action: 'Toggle light / dark' },
  { keys: <Kbd>t</Kbd>, action: 'Cycle theme' },
  { keys: <Kbd>q</Kbd>, action: 'Quit' },
]

type ShortcutsDialogProps = {
  open: boolean
  onClose: () => void
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(
    function syncDialogOpen() {
      const dialog = dialogRef.current
      if (!dialog) return
      if (open && !dialog.open) dialog.showModal()
      if (!open && dialog.open) dialog.close()
    },
    [open],
  )

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="shortcuts-dialog-title"
      onClose={onClose}
      // Clicks on the backdrop land on the <dialog> itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-2xl border border-fd-border bg-fd-popover p-0 text-fd-popover-foreground shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-[3px]"
    >
      <div className="flex items-center justify-between border-b border-fd-border px-4 py-3.5">
        <h2 id="shortcuts-dialog-title" className="font-semibold">
          Keyboard shortcuts
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-fd-border px-3 py-0.5 text-[0.8125rem] text-fd-muted-foreground transition-colors hover:text-fd-foreground"
        >
          Esc
        </button>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {globalShortcuts.map(({ keys, action }) => (
            <tr key={action} className="border-b border-fd-border">
              <td className="w-[42%] px-4 py-2 whitespace-nowrap">{keys}</td>
              <td className="px-4 py-2">{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-[0.8125rem] text-fd-muted-foreground">
        Hover a feature card to use its own keys. In the app, <Kbd>?</Kbd> lists every key for the
        current tab.{' '}
        <Link
          href={`${docsRoute}/shortcuts`}
          onClick={onClose}
          className="font-medium text-(--home-accent-ink) underline-offset-4 hover:underline"
        >
          All shortcuts
        </Link>
      </p>
    </dialog>
  )
}
