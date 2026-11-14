import { cache } from 'react'
import { fetchGitHubRepoJson, isRecord } from '@/lib/github-api'

/**
 * Hourly-cached star count. Returns null on any fetch/API failure so the docs
 * shell stays up when the repo is private or GitHub is unreachable.
 */
export const getGitHubStars = cache(async (): Promise<number | null> => {
  const repository = await fetchGitHubRepoJson('')
  if (!isRecord(repository)) {
    return null
  }
  const stargazersCount = repository.stargazers_count
  return typeof stargazersCount === 'number' ? stargazersCount : null
})
