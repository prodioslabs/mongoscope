'use client'

import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { installCurlCommand } from '@/lib/shared'

type CopyStatus = 'idle' | 'copied' | 'failed'

type CopyInstallButtonProps = {
  variant?: 'inline' | 'pill'
  className?: string
}

export function CopyInstallButton({ variant = 'inline', className }: CopyInstallButtonProps) {
  const [status, setStatus] = useState<CopyStatus>('idle')

  useEffect(
    function resetCopyStatus() {
      if (status === 'idle') return
      const timer = window.setTimeout(() => setStatus('idle'), 1600)
      return () => window.clearTimeout(timer)
    },
    [status],
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(installCurlCommand)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }

  const label =
    status === 'copied' ? 'Copied' : status === 'failed' ? 'Select to copy' : 'Copy install command'
  const Icon = status === 'copied' ? Check : Copy

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={copy}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-background px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent',
          className,
        )}
      >
        <Icon className="size-4" aria-hidden />
        <span aria-live="polite">{label}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-fd-border bg-fd-secondary px-2.5 py-1 text-xs font-medium transition-colors hover:bg-fd-accent',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span aria-live="polite">{status === 'idle' ? 'Copy' : label}</span>
    </button>
  )
}
