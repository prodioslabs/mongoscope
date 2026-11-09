'use client'

import dynamic from 'next/dynamic'

/** Client-only so `ssr: false` is legal; keeps the terminal mock off the SSR/hydration path. */
export const TuiPreviewLazy = dynamic(
  () => import('./tui-preview').then((module) => module.TuiPreview),
  {
    ssr: false,
    loading: function TuiPreviewLoading() {
      return (
        <div
          aria-hidden
          className="min-h-72 rounded-xl border border-fd-border bg-tui-card shadow-[0_24px_48px_-28px_var(--tui-shadow)]"
        />
      )
    },
  },
)
