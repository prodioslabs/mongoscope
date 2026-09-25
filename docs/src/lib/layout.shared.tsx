import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { GitHubStarLink } from '@/components/github-star'
import { MongoScopeMark } from '@/components/mongoscope-mark'
import { appName, docsRoute, githubRepoUrl } from './shared'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <MongoScopeMark className="size-6" />
          {appName}
        </>
      ),
    },
    links: [
      {
        text: 'Documentation',
        url: docsRoute,
        active: 'nested-url',
      },
      {
        type: 'custom',
        secondary: true,
        children: <GitHubStarLink />,
      },
    ],
    githubUrl: githubRepoUrl,
  }
}
