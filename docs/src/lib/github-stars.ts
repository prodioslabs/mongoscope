import { cache } from 'react'
import { gitConfig } from '@/lib/shared'

type GitHubRepoResponse = {
  stargazers_count?: number
}

/**
 * Hourly-cached star count. Returns null on any fetch/API failure so the docs
 * shell stays up when the repo is private or GitHub is unreachable.
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
      return null
    }

    const data = (await response.json()) as GitHubRepoResponse
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null
  } catch {
    return null
  }
})
