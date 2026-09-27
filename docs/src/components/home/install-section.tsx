'use client'

import { Apple, Monitor } from 'lucide-react'
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import {
  docsRoute,
  githubRepoUrl,
  installCurlCommand,
} from '@/lib/shared'

type InstallSectionProps = {
  className?: string
}

/**
 * Landing-page install CTA. install.sh detects OS/arch itself, so one curl
 * command covers macOS + Linux; Windows is release-download only.
 */
export function InstallSection({ className }: InstallSectionProps) {
  return (
    <section
      className={cn(
        'mx-auto w-full max-w-(--fd-layout-width) min-w-0 px-4 sm:px-6',
        className,
      )}
      aria-labelledby="install-heading"
    >
      <div className="rounded-2xl border border-fd-border bg-fd-card px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="install-heading"
            className="text-lg font-semibold tracking-tight text-fd-foreground sm:text-xl"
          >
            Install
          </h2>
          <ul className="flex flex-wrap items-center gap-2 text-fd-muted-foreground">
            <OsChip icon={<Apple className="size-3.5" aria-hidden />} label="macOS" />
            <OsChip icon={<Monitor className="size-3.5" aria-hidden />} label="Linux" />
            <OsChip icon={<WindowsMark className="size-3.5" />} label="Windows" muted />
          </ul>
        </div>

        <p className="mb-4 max-w-2xl text-sm text-pretty text-fd-muted-foreground">
          One command for macOS and Linux — the installer detects your OS and architecture.
          Windows builds ship on{' '}
          <a
            href={`${githubRepoUrl}/releases`}
            className="font-medium text-fd-primary underline-offset-4 hover:underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            GitHub Releases
          </a>
          .
        </p>

        <div className="min-w-0 overflow-x-auto">
          <DynamicCodeBlock
            lang="bash"
            code={installCurlCommand}
            codeblock={{
              title: 'Terminal',
              className: 'my-0 max-w-full',
              viewportProps: {
                className: 'overflow-x-auto',
              },
            }}
          />
        </div>

        <p className="mt-4 text-sm text-fd-muted-foreground">
          Building from source?{' '}
          <Link
            href={`${docsRoute}/getting-started`}
            className="font-medium text-fd-foreground underline-offset-4 hover:underline"
          >
            Contributor setup
          </Link>{' '}
          (clone, <code className="text-fd-foreground">bun install</code>,{' '}
          <code className="text-fd-foreground">bun start</code>).
        </p>
      </div>
    </section>
  )
}

type OsChipProps = {
  icon: ReactNode
  label: string
  muted?: boolean
}

function OsChip({ icon, label, muted = false }: OsChipProps) {
  return (
    <li
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        muted
          ? 'border-fd-border text-fd-muted-foreground'
          : 'border-fd-border bg-fd-secondary/40 text-fd-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
    </li>
  )
}

type WindowsMarkProps = {
  className?: string
}

function WindowsMark({ className }: WindowsMarkProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M0 2.2 6.6 1.3v6.1H0zm7.4-.9L16 0v7.4H7.4zM0 8.6h6.6v6.1L0 13.8zm7.4 0H16V16l-8.6-1.2z" />
    </svg>
  )
}
