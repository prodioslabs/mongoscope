import { cache } from 'react'
import { fetchGitHubRepoJson, isRecord } from '@/lib/github-api'
import { releasesUrl } from '@/lib/shared'

type LatestRelease = {
  /** Tag without the leading `v`, as used in release asset file names. */
  version: string
  windowsZipUrl: string
  checksumsUrl: string
}

const releaseDownloadUrlPrefix = `${releasesUrl}/download/`

/** Same tag shape the release job accepts; the version is pasted into shell commands. */
const releaseTagPattern = /^v(\d+\.\d+\.\d+(?:[.-][0-9A-Za-z.-]+)?)$/

/**
 * Hourly-cached newest GitHub Release (`/releases/latest` skips prereleases and drafts).
 * Returns null when GitHub is unreachable or rate limited, no release exists, or the release
 * lacks a Windows zip or checksums.txt, so callers link to the Releases page instead.
 */
export const getLatestRelease = cache(async (): Promise<LatestRelease | null> => {
  const release = await fetchGitHubRepoJson('/releases/latest')
  if (!isRecord(release)) {
    return null
  }

  const tagName = release.tag_name
  const assets = release.assets
  if (typeof tagName !== 'string' || !Array.isArray(assets)) {
    return null
  }

  const version = releaseTagPattern.exec(tagName)?.[1]
  if (version === undefined) {
    return null
  }

  const windowsZipUrl = findAssetDownloadUrl(assets, (name) => name.endsWith('_windows_amd64.zip'))
  const checksumsUrl = findAssetDownloadUrl(assets, (name) => name === 'checksums.txt')
  if (windowsZipUrl === null || checksumsUrl === null) {
    return null
  }

  return {
    version,
    windowsZipUrl,
    checksumsUrl,
  }
})

function findAssetDownloadUrl(
  assets: unknown[],
  isWantedName: (name: string) => boolean,
): string | null {
  for (const asset of assets) {
    if (!isRecord(asset)) {
      continue
    }
    const name = asset.name
    const downloadUrl = asset.browser_download_url
    if (
      typeof name === 'string' &&
      isWantedName(name) &&
      typeof downloadUrl === 'string' &&
      downloadUrl.startsWith(releaseDownloadUrlPrefix)
    ) {
      return downloadUrl
    }
  }
  return null
}
