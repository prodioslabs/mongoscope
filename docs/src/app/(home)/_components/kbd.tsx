import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type KbdProps = {
  children: ReactNode
  className?: string
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-[1.5em] items-center justify-center rounded-[5px] border border-b-2 border-fd-border bg-fd-secondary px-1 font-mono text-[0.75em] leading-[1.45] font-medium text-fd-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
