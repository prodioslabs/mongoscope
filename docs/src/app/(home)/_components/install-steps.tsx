import { ServerCodeBlock } from 'fumadocs-ui/components/codeblock.rsc'
import { Download } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { getLatestRelease } from '@/lib/github-release'
import { docsRoute, installCurlCommand, releasesUrl } from '@/lib/shared'
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
          <InstallPlatformPicker
            unixInstall={<TerminalCodeBlock code={installCurlCommand} />}
            windowsInstall={<WindowsInstall />}
          />
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

async function WindowsInstall() {
  const release = await getLatestRelease()
  const zipName = `mongoscope_${release?.version ?? '<version>'}_windows_amd64.zip`
  // Unverified on a real Windows machine: Expand-Archive folder creation, User Path
  // Get/SetEnvironmentVariable, case-insensitive PATH membership (including trailing-
  // backslash variants), new terminals picking up Path, mongoscope.exe --version,
  // Get-FileHash, and whether Windows shows a download warning. Same install folder as
  // docs/content/docs/installation.mdx (%LOCALAPPDATA%\Programs\mongoscope).
  const installScript = [
    `$zip = '${zipName}'`,
    String.raw`$dir = "$env:LOCALAPPDATA\Programs\mongoscope"`,
    'Expand-Archive $zip -DestinationPath $dir -Force',
    "$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')",
    "if ($null -eq $userPath) { $userPath = '' }",
    "$entries = @(($userPath -split ';' | Where-Object { $_ }))",
    String.raw`$normalizedDir = $dir.TrimEnd('\')`,
    String.raw`if (-not ($entries | Where-Object { $_.TrimEnd('\').Equals($normalizedDir, [StringComparison]::OrdinalIgnoreCase) })) {`,
    "  [Environment]::SetEnvironmentVariable('Path', (($entries + $dir) -join ';'), 'User')",
    '}',
  ].join('\n')

  return (
    <div className="flex flex-col gap-3 text-sm text-pretty text-fd-muted-foreground">
      {release ? (
        <a
          href={release.windowsZipUrl}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-fd-border px-3 py-1.5 font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
        >
          <Download className="size-4" aria-hidden />
          Download v{release.version} (.zip)
        </a>
      ) : (
        <p>
          Download the Windows <code className="text-fd-foreground">.zip</code> from{' '}
          <InlineLink href={releasesUrl}>GitHub Releases</InlineLink>.
        </p>
      )}
      <p>
        Windows may show a warning for an unsigned download. Compare the zip against{' '}
        <InlineLink href={release?.checksumsUrl ?? releasesUrl}>checksums.txt</InlineLink>
        {release ? null : ' from the same release'} to verify it.
      </p>
      <p>
        In PowerShell, from the folder that contains the zip
        {release ? null : (
          <>
            {' '}
            (replace <code className="text-fd-foreground">&lt;version&gt;</code> with the version in
            its name)
          </>
        )}
        :
      </p>
      <TerminalCodeBlock code={installScript} lang="powershell" />
      <p>
        Open a new terminal, then run{' '}
        <code className="text-fd-foreground">mongoscope --version</code>.
      </p>
      <p>
        Optional: compare <code className="text-fd-foreground">Get-FileHash $zip</code> with the
        zip&apos;s line in{' '}
        <InlineLink href={release?.checksumsUrl ?? releasesUrl}>checksums.txt</InlineLink>
        {release ? null : ' from the same release'}.
      </p>
      <p>
        x86_64 only; Windows ARM64 builds are not published.{' '}
        <Link
          href={`${docsRoute}/installation#windows`}
          className="font-medium text-fd-foreground underline-offset-4 hover:underline"
        >
          Full steps
        </Link>
      </p>
    </div>
  )
}

type InlineLinkProps = {
  href: string
  children: ReactNode
}

function InlineLink({ href, children }: InlineLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-(--home-accent-ink) underline-offset-4 hover:underline"
    >
      {children}
    </a>
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

const codeBlockTitles = {
  bash: 'Terminal',
  powershell: 'PowerShell',
} as const

type TerminalCodeBlockProps = {
  code: string
  lang?: keyof typeof codeBlockTitles
}

function TerminalCodeBlock({ code, lang = 'bash' }: TerminalCodeBlockProps) {
  return (
    <div className="min-w-0">
      {/* Default themes match the docs: github-light / github-dark. */}
      <ServerCodeBlock
        lang={lang}
        code={code}
        codeblock={{
          // A title moves the copy button into a header instead of over long commands.
          title: codeBlockTitles[lang],
          className: 'my-0 max-w-full',
          viewportProps: {
            className: 'overflow-x-auto',
          },
        }}
      />
    </div>
  )
}
