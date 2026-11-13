import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { docsRoute, installCurlCommand } from '@/lib/shared'
import { InstallPlatformPicker } from './install-platform-picker'
import { Kbd } from './kbd'
import { HomeSection, SectionHeading } from './section'

/** Labels sit outside the highlighter — Shiki comment tokens fail WCAG AA on the dark code bg. */
const pointExamples = [
  {
    label: 'Offline — parse a log file',
    code: 'mongoscope --log-path ./mongod.log',
  },
  {
    label: 'Live — session-only connection',
    code: 'mongoscope --uri mongodb://localhost:27017',
  },
] as const

/**
 * Server component: commands are highlighted at build time so the home page ships no
 * Shiki runtime, grammar, or themes (client-side highlighting was ~300ms of mobile TBT).
 * Only the platform toggle hydrates.
 */
export function InstallSteps() {
  return (
    <HomeSection id="install" labelledBy="install-heading">
      <SectionHeading
        id="install-heading"
        eyebrow="Up in a minute"
        title="Install, point, explore."
        description="No server, no agent, no port. Bring a log file or a connection string."
      />

      <ol className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Step number={1} title="Install">
          <InstallPlatformPicker unixInstall={<TerminalCodeBlock code={installCurlCommand} />} />
        </Step>

        <Step
          number={2}
          title="Point it at something"
          description="Analyse a log file offline, or connect live."
        >
          <div className="flex flex-col gap-3">
            {pointExamples.map((example) => (
              <div key={example.code} className="min-w-0">
                <p className="mb-1.5 text-xs font-medium text-fd-muted-foreground">
                  {example.label}
                </p>
                <TerminalCodeBlock code={example.code} />
              </div>
            ))}
          </div>
        </Step>

        <Step
          number={3}
          title="Explore with the keyboard"
          description={
            <>
              Switch tabs with <Kbd>1</Kbd>–<Kbd>5</Kbd>, open anything with <Kbd>Ctrl</Kbd>{' '}
              <Kbd>K</Kbd>, press <Kbd>?</Kbd> for help.
            </>
          }
        >
          <p className="rounded-lg border border-fd-border bg-fd-secondary/50 px-3 py-2 font-mono text-xs text-fd-muted-foreground">
            c count · a avg · p plan · g regr · enter details
          </p>
        </Step>
      </ol>

      <p className="mt-5 text-sm text-fd-muted-foreground">
        Building from source?{' '}
        <Link
          href={`${docsRoute}/getting-started`}
          className="font-medium text-fd-foreground underline-offset-4 hover:underline"
        >
          Contributor setup
        </Link>{' '}
        (clone, <code className="text-fd-foreground">bun install</code>,{' '}
        <code className="text-fd-foreground">bun start</code>).
      </p>
    </HomeSection>
  )
}

type StepProps = {
  number: number
  title: string
  description?: ReactNode
  children: ReactNode
}

function Step({ number, title, description, children }: StepProps) {
  return (
    <li className="min-w-0 rounded-2xl border border-fd-border bg-tui-card p-5 shadow-[0_1px_2px_var(--tui-shadow-soft)]">
      <h3 className="mb-1.5 flex items-center gap-2.5 font-semibold">
        <span className="grid size-6 place-items-center rounded-full border border-fd-border text-xs text-fd-muted-foreground">
          {number}
        </span>
        {title}
      </h3>
      {description ? (
        <p className="mb-3 text-sm text-pretty text-fd-muted-foreground">{description}</p>
      ) : null}
      {children}
    </li>
  )
}

type TerminalCodeBlockProps = {
  code: string
}

function TerminalCodeBlock({ code }: TerminalCodeBlockProps) {
  return (
    <div className="min-w-0">
      {/* Default themes match the docs: github-light / github-dark. */}
      <ServerCodeBlock
        lang="bash"
        code={code}
        codeblock={{
          // A title moves the copy button into a header instead of over long commands.
          title: 'Terminal',
          className: 'my-0 max-w-full',
          viewportProps: {
            className: 'overflow-x-auto',
          },
        }}
      />
    </div>
  )
}
