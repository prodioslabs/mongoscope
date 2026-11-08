import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { MongoScopeMark } from '@/components/mongoscope-mark'
import { docsRoute } from '@/lib/shared'
import { CopyInstallButton } from './copy-install-button'

export function ClosingCta() {
  return (
    <section className="px-4 pb-16 sm:px-6 sm:pb-18" aria-labelledby="closing-heading">
      <div className="mx-auto w-full max-w-(--fd-layout-width) rounded-3xl border border-fd-border bg-white dark:bg-fd-card bg-[radial-gradient(ellipse_at_top,var(--home-accent-soft),transparent_70%)] px-6 py-11 text-center">
        <MongoScopeMark className="mx-auto size-14" />
        <h2
          id="closing-heading"
          className="mt-4 mb-2 text-[clamp(1.6rem,3.4vw,2.25rem)] leading-[1.15] font-bold tracking-tight text-balance"
        >
          Stop guessing why Mongo is slow.
        </h2>
        <p className="mb-5.5 text-fd-muted-foreground">
          Free and open source. Install in one line.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Link
            href={`${docsRoute}/getting-started`}
            className="inline-flex items-center gap-2 rounded-full bg-fd-foreground px-5 py-2.5 text-sm font-medium text-fd-background transition-opacity hover:opacity-90"
          >
            Get started
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <CopyInstallButton variant="pill" />
        </div>
      </div>
    </section>
  )
}
