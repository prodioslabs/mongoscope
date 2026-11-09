import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { GitHubStarLink } from '@/components/github-star'
import { MongoScopeMark } from '@/components/mongoscope-mark'
import { appName, docsRoute } from './shared'

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
        // Fumadocs renders `custom` children raw inside the header `<ul>`; wrap in `<li>`.
        children: (
          <li className="list-none">
            <GitHubStarLink />
          </li>
        ),
      },
    ],
  }
}
