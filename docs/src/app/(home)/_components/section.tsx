import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type HomeSectionProps = {
  id?: string
  labelledBy?: string
  className?: string
  children: ReactNode
}

export function HomeSection({ id, labelledBy, className, children }: HomeSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        'scroll-mt-14 border-t border-fd-border px-4 py-16 sm:px-6 sm:py-18',
        className,
      )}
    >
      <div className="mx-auto w-full max-w-(--fd-layout-width) min-w-0">{children}</div>
    </section>
  )
}

type SectionHeadingProps = {
  id: string
  eyebrow: string
  title: string
  description: ReactNode
}

export function SectionHeading({ id, eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold tracking-[0.08em] text-(--home-accent-ink) uppercase">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-2 mb-2.5 text-[clamp(1.6rem,3.4vw,2.25rem)] leading-[1.15] font-bold tracking-tight text-balance"
      >
        {title}
      </h2>
      <p className="max-w-[42em] text-pretty text-fd-muted-foreground">{description}</p>
    </div>
  )
}
