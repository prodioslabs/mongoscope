import { gitConfig } from '@/lib/shared'

/**
 * Hourly-cached GET of `https://api.github.com/repos/<owner>/<repo><path>`. Returns the parsed
 * JSON body, or null on any network, timeout, HTTP, or parse failure so callers can render a
 * fallback instead of failing the page.
 */
export async function fetchGitHubRepoJson(path: string): Promise<unknown> {
  try {
    const headers = new Headers({ Accept: 'application/vnd.github+json' })
    const token = process.env.GITHUB_TOKEN
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const response = await fetch(
      `https://api.github.com/repos/${gitConfig.user}/${gitConfig.repo}${path}`,
      {
        headers,
        next: { revalidate: 3600 },
        // Next drops this signal when it refreshes a stale cached entry during ISR; it still
        // bounds the build and a cold cache.
        signal: AbortSignal.timeout(5000),
      },
    )

    if (!response.ok) {
      return null
    }

    const data: unknown = await response.json()
    return data
  } catch {
    return null
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
