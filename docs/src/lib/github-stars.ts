import { cache } from 'react'
import { gitConfig } from '@/lib/shared'

type GitHubRepoResponse = {
  stargazers_count?: number
}

/**
 * Cached GitHub star count (hourly revalidate).
 * Returns null when the repo is missing/private, unauthenticated, or the request fails —
 * so local docs keep working before the GitHub repo is public.
 */
export const getGitHubStars = cache(async (): Promise<number | null> => {
  try {
    const headers = new Headers({ Accept: 'application/vnd.github+json' })
    const token = process.env.GITHUB_TOKEN
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await fetch(
      `https://api.github.com/repos/${gitConfig.user}/${gitConfig.repo}`,
      {
        headers,
        next: { revalidate: 3600 },
      },
    )

    if (!response.ok) {
      // 404 is expected for private or not-yet-published repos without a token.
      return null
    }

    const data = (await response.json()) as GitHubRepoResponse
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null
  } catch {
    return null
  }
})
