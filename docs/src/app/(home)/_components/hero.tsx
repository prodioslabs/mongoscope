import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { docsRoute, installCurlCommand, latestRelease, releasesUrl } from '@/lib/shared'
import { CopyInstallButton } from './copy-install-button'
import { TuiPreview } from './tui-preview'

export function Hero() {
  return (
    <section className="px-4 pt-14 pb-12 sm:px-6 lg:pt-18 lg:pb-14">
      <div className="mx-auto grid w-full max-w-(--fd-layout-width) min-w-0 grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12">
        <div className="min-w-0">
          <a
            href={`${releasesUrl}/tag/v${latestRelease.version}`}
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex max-w-full items-center gap-2 rounded-full border border-fd-border bg-white py-1 pr-3 dark:bg-fd-card pl-1 text-[0.8125rem] text-fd-muted-foreground transition-colors hover:text-fd-foreground"
          >
            <span className="rounded-full bg-(--home-accent-soft) px-2 py-0.5 text-xs font-semibold text-(--home-accent-ink)">
              v{latestRelease.version}
            </span>
            <span className="truncate">{latestRelease.highlight}</span>
            <ArrowRight
              className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </a>

          <h1 className="mt-5 mb-4 text-[clamp(2.125rem,3.6vw,3rem)] leading-[1.05] font-bold tracking-[-0.035em] text-balance">
            MongoDB diagnostics,
            <br />
            <span className="text-(--home-accent-ink)">right in your terminal.</span>
          </h1>
          <p className="mb-7 max-w-[34em] text-[1.0625rem] text-pretty text-fd-muted-foreground">
            Find slow queries, watch live operations, check replication lag, audit indexes and tail
            logs — one keyboard-driven TUI. No browser, no agent.
          </p>

          <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-fd-border bg-white py-2.5 pr-2.5 dark:bg-fd-card pl-3.5 text-[0.8125rem]">
            <code className="min-w-0 flex-1 overflow-x-auto font-mono whitespace-nowrap scrollbar-none">
              <span className="text-(--home-accent-ink) select-none">$ </span>
              {installCurlCommand}
            </code>
            <CopyInstallButton />
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href={`${docsRoute}/getting-started`}
              className="inline-flex items-center gap-2 rounded-full bg-fd-foreground px-5 py-2.5 text-sm font-medium text-fd-background transition-opacity hover:opacity-90"
            >
              Get started
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href={docsRoute}
              className="rounded-full border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
            >
              Read the docs
            </Link>
          </div>

          <ul className="mt-5.5 flex flex-wrap gap-x-4.5 gap-y-1.5 text-[0.8125rem] text-fd-muted-foreground">
            {['macOS · Linux · Windows', 'Works offline on log files', 'MIT licensed'].map(
              (item) => (
                <li key={item} className="before:text-(--home-accent-ink) before:content-['✓_']">
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        <TuiPreview />
      </div>
    </section>
  )
}
