import { markHandle, markLens, markPulse, markViewBox } from './mark-geometry'

type MongoScopeMarkProps = {
  className?: string
}

export function MongoScopeMark({ className }: MongoScopeMarkProps) {
  return (
    <svg
      viewBox={markViewBox}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <circle
        cx={markLens.cx}
        cy={markLens.cy}
        r={markLens.r}
        stroke="currentColor"
        strokeWidth={markLens.strokeWidth}
      />
      <path d={markHandle.d} stroke="currentColor" strokeWidth={markHandle.strokeWidth} />
      <path d={markPulse.d} stroke="var(--ms-accent)" strokeWidth={markPulse.strokeWidth} />
    </svg>
  )
}
