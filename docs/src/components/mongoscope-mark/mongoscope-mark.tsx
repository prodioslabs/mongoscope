import {
  markBars,
  markColors,
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
        fill={markColors.tile}
        stroke={markColors.tileEdge}
      />
      <circle
        cx={markLens.cx}
        cy={markLens.cy}
        r={markLens.r}
        stroke={markColors.lens}
        strokeWidth={markLens.strokeWidth}
      />
      <path d={markHandle.d} stroke={markColors.lens} strokeWidth={markHandle.strokeWidth} />
      <path d={markBars.d} stroke={markColors.bars} strokeWidth={markBars.strokeWidth} />
      <path d={markSpike.d} stroke={markColors.spike} strokeWidth={markSpike.strokeWidth} />
    </svg>
  )
}
