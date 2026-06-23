import { clsx } from 'clsx'

export type ChartTone = 'green' | 'yellow' | 'red' | 'gray' | 'brand' | 'lime'

/** Tailwind text-color per tone — used as `currentColor` for SVG stroke/fill. */
export const TONE_TEXT: Record<ChartTone, string> = {
  green: 'text-green-500',
  yellow: 'text-yellow-400',
  red: 'text-red-500',
  gray: 'text-gs',
  brand: 'text-gd',
  lime: 'text-gn',
}

export interface DonutSegment {
  label: string
  value: number
  tone: ChartTone
}

interface DonutChartProps {
  segments: DonutSegment[]
  /** Diameter in px. */
  size?: number
  thickness?: number
  centerLabel?: string
  centerSub?: string
  /** Show the label/value legend to the right of the ring. */
  showLegend?: boolean
  className?: string
}

/**
 * Lightweight SVG donut (no chart lib — ui.md §2). Segments are arcs drawn with
 * stroke-dasharray on stacked circles; colors come from design tokens via the
 * tone → text-color map and `stroke="currentColor"`.
 */
export function DonutChart({
  segments,
  size = 132,
  thickness = 16,
  centerLabel,
  centerSub,
  showLegend = true,
  className,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  let offset = 0
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const fraction = total > 0 ? s.value / total : 0
      const length = fraction * circumference
      const arc = {
        ...s,
        dashArray: `${length} ${circumference - length}`,
        dashOffset: -offset,
      }
      offset += length
      return arc
    })

  const ariaLabel = segments.map((s) => `${s.label}: ${s.value}`).join(', ')

  return (
    <div className={clsx('flex items-center gap-4', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
        className="shrink-0"
      >
        {/* Arcs start at 12 o'clock — rotate only the ring group (SVG-native
            transform, not a CSS class, so the center text stays upright). */}
        <g transform={`rotate(-90 ${center} ${center})`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={thickness}
            className="text-gs/50"
            stroke="currentColor"
          />
          {arcs.map((arc, i) => (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              strokeWidth={thickness}
              strokeDasharray={arc.dashArray}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="butt"
              className={clsx(TONE_TEXT[arc.tone], 'transition-all duration-500')}
              stroke="currentColor"
            />
          ))}
        </g>
        {centerLabel && (
          <text
            x={center}
            y={centerSub ? center - 2 : center + 5}
            textAnchor="middle"
            className="fill-gd font-sora font-semibold"
            style={{ fontSize: 22 }}
          >
            {centerLabel}
          </text>
        )}
        {centerSub && (
          <text x={center} y={center + 16} textAnchor="middle" className="fill-gx" style={{ fontSize: 11 }}>
            {centerSub}
          </text>
        )}
      </svg>

      {showLegend && (
        <ul className="space-y-1.5 min-w-0">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-xs">
              <span className={clsx('w-2.5 h-2.5 rounded-full shrink-0', TONE_TEXT[s.tone])} style={{ backgroundColor: 'currentColor' }} aria-hidden="true" />
              <span className="text-gx truncate">{s.label}</span>
              <span className="text-gd font-semibold tabular-nums ml-auto">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
