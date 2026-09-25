import { Star } from 'lucide-react'
import { Suspense, use } from 'react'
import { cn } from '@/lib/cn'
import { getGitHubStars } from '@/lib/github-stars'
import { gitConfig } from '@/lib/shared'

export const githubRepoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`

const starFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

type GitHubStarLinkProps = {
  className?: string
  variant?: 'nav' | 'hero'
}

export function GitHubStarLink(props: GitHubStarLinkProps) {
  return (
    <Suspense fallback={<GitHubStarAnchor stars={null} {...props} />}>
      <GitHubStarLinkInner {...props} />
    </Suspense>
  )
}

function GitHubStarLinkInner(props: GitHubStarLinkProps) {
  return <GitHubStarAnchor stars={use(getGitHubStars())} {...props} />
}

function GitHubStarAnchor({
  stars,
  className,
  variant = 'nav',
}: GitHubStarLinkProps & { stars: number | null }) {
  const isHero = variant === 'hero'

  return (
    <a
      href={githubRepoUrl}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={
        stars != null
          ? `Star MongoScope on GitHub (${starFormatter.format(stars)} stars)`
          : 'Star MongoScope on GitHub'
      }
      className={cn(
        'inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors',
        isHero
          ? 'rounded-full border px-5 py-2.5 hover:bg-fd-accent'
          : 'rounded-lg px-2 py-1.5 text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground',
        className,
      )}
    >
      <GitHubMark className="size-3.5" />
      <span>{isHero ? 'Star on GitHub' : 'Star'}</span>
      {stars != null ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 tabular-nums',
            isHero
              ? 'rounded-full bg-fd-accent px-2 py-0.5 text-xs text-fd-accent-foreground'
              : 'text-fd-foreground',
          )}
        >
          <Star className="size-3 fill-current" aria-hidden />
          {starFormatter.format(stars)}
        </span>
      ) : null}
    </a>
  )
}

type GitHubMarkProps = {
  className?: string
}

function GitHubMark({ className }: GitHubMarkProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
    </svg>
  )
}
