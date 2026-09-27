import { createGetUrl } from 'fumadocs-core/source'

export const appName = 'MongoScope'
export const docsRoute = '/docs'
const docsImageRoute = '/og/docs'
export const docsContentRoute = '/llms.mdx/docs'
const docsContentDir = 'content/docs'

export const gitConfig = {
  user: 'prodioslabs',
  repo: 'mongoscope-v2',
  branch: 'main',
}

export const githubRepoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`

/** Raw install.sh on the default branch — same URL the README curl one-liner uses. */
const installScriptUrl = `https://raw.githubusercontent.com/${gitConfig.user}/${gitConfig.repo}/${gitConfig.branch}/install.sh`

export const installCurlCommand = `curl -fsSL ${installScriptUrl} | bash`

export function getDocsGithubBlobUrl(pagePath: string) {
  return `${githubRepoUrl}/blob/${gitConfig.branch}/${docsContentDir}/${pagePath}`
}

type DocsPagePath = {
  slugs: string[]
  locale?: string
}

 type DocsPageAssetUrl = {
  segments: string[]
  url: string
}

function createPageAssetUrl(
  baseRoute: string,
  filename: string,
): (page: DocsPagePath) => DocsPageAssetUrl {
  const getUrl = createGetUrl(baseRoute)

  return (page: DocsPagePath): DocsPageAssetUrl => {
    const segments = [...page.slugs, filename]
    return { segments, url: getUrl(segments, page.locale) }
  }
}

export const getPageMarkdownUrl = createPageAssetUrl(docsContentRoute, 'content.md')
export const getPageImageUrl = createPageAssetUrl(docsImageRoute, 'image.png')
