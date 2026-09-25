import Link from 'next/link'
import { GitHubStarLink } from '@/components/github-star'
import { TuiMockup } from '@/components/home/tui-mockup'
import { MongoScopeMark } from '@/components/mongoscope-mark'

export default function HomePage() {
  return (
    <section className="flex flex-1 flex-col px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto grid w-full max-w-(--fd-layout-width) min-w-0 flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12">
        <div className="min-w-0 text-center lg:text-left">
          <p className="mb-3 text-sm font-medium text-fd-muted-foreground">
            Terminal UI for MongoDB
          </p>
          <h1 className="mb-4 flex items-center justify-center gap-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:justify-start lg:text-5xl">
            <MongoScopeMark className="size-[1em] shrink-0" />
            MongoScope
          </h1>
          <p className="mb-8 text-base text-pretty text-fd-muted-foreground sm:text-lg">
            Inspect slow queries, live operations, replication, indexes, and logs — from a real
            interactive TTY, built with Bun and OpenTUI.
          </p>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-start">
            <Link
              href="/docs"
              className="rounded-full bg-fd-primary px-5 py-2.5 text-center text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
            >
              Read the docs
            </Link>
            <Link
              href="/docs/getting-started"
              className="rounded-full border px-5 py-2.5 text-center text-sm font-medium transition-colors hover:bg-fd-accent"
            >
              Getting started
            </Link>
            <GitHubStarLink variant="hero" />
          </div>
        </div>

        <div className="min-w-0">
          <TuiMockup />
        </div>
      </div>
    </section>
  )
}
