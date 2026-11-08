import Link from 'next/link'
import { MongoScopeMark } from '@/components/mongoscope-mark'
import { docsRoute, gitConfig, githubRepoUrl, latestRelease, releasesUrl } from '@/lib/shared'

const externalLinks = [
  { label: 'GitHub', href: githubRepoUrl },
  { label: 'Releases', href: releasesUrl },
  { label: 'Report an issue', href: `${githubRepoUrl}/issues/new` },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-fd-border px-4 py-7 text-[0.8125rem] text-fd-muted-foreground sm:px-6">
      <div className="mx-auto flex w-full max-w-(--fd-layout-width) flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <MongoScopeMark className="size-5" />
          {/* Copyright year follows LICENSE. */}
          <span>
            © 2026 {gitConfig.user} · MIT License · v{latestRelease.version}
          </span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4.5 gap-y-2">
          <Link href={docsRoute} className="transition-colors hover:text-fd-foreground">
            Docs
          </Link>
          {externalLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              className="transition-colors hover:text-fd-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  )
}
