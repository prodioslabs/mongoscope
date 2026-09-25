import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { GitHubStarLink } from '@/components/github-star'
import { MongoScopeMark } from '@/components/mongoscope-mark'
import { appName, gitConfig } from './shared'

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
        url: '/docs',
        active: 'nested-url',
      },
      {
        type: 'custom',
        secondary: true,
        children: <GitHubStarLink />,
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  }
}
