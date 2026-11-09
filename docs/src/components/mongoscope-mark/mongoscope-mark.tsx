import {
  markBars,
  markColorVars,
  markHandle,
  markLens,
  markSpike,
  markTile,
  markViewBox,
} from './mark-geometry'

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
      <rect
        x={markTile.x}
        y={markTile.y}
        width={markTile.size}
        height={markTile.size}
        rx={markTile.radius}
        fill={markColorVars.tile}
        stroke={markColorVars.tileEdge}
      />
      <circle
        cx={markLens.cx}
        cy={markLens.cy}
        r={markLens.r}
        stroke={markColorVars.lens}
        strokeWidth={markLens.strokeWidth}
      />
      <path d={markHandle.d} stroke={markColorVars.lens} strokeWidth={markHandle.strokeWidth} />
      <path d={markBars.d} stroke={markColorVars.bars} strokeWidth={markBars.strokeWidth} />
      <path d={markSpike.d} stroke={markColorVars.spike} strokeWidth={markSpike.strokeWidth} />
    </svg>
  )
}
