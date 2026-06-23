import { clsx } from 'clsx'
import { TONE_TEXT, type ChartTone } from './donut-chart'

export interface TrendSeries {
  label: string
  points: number[]
  tone: ChartTone
  /** Fill the area under the line (low opacity). */
  area?: boolean
}

interface TrendChartProps {
  /** X-axis labels, aligned 1:1 to each series' points. */
  labels: string[]
  series: TrendSeries[]
  height?: number
  /** Fixed Y upper bound (e.g. 100 for percentages). Defaults to the data max. */
  yMax?: number
  /** How many x labels to render (evenly sampled). Default 5. */
  maxXLabels?: number
  emptyLabel?: string
  className?: string
}

const VIEW_W = 600
const PAD_Y = 8

/**
 * Multi-series line/area trend (no chart lib — ui.md §2). The SVG draws only the
 * lines/areas with `preserveAspectRatio="none"` so it stretches to full width;
 * `vector-effect="non-scaling-stroke"` keeps the stroke crisp despite the x-scale,
 * and axis labels are HTML (never distorted). Token-colored via tone → currentColor.
 */
export function TrendChart({
  labels,
  series,
  height = 160,
  yMax,
  maxXLabels = 5,
  emptyLabel = 'Sem dados no período.',
  className,
}: TrendChartProps) {
  const n = labels.length
  const hasData = n > 0 && series.some((s) => s.points.length > 0)
  if (!hasData) {
    return (
      <div className={clsx('flex items-center justify-center text-xs text-gx', className)} style={{ height }}>
        {emptyLabel}
      </div>
    )
  }

  const dataMax = Math.max(1, yMax ?? Math.max(...series.flatMap((s) => s.points)))
  const plotH = height - PAD_Y * 2
  const x = (i: number) => (n === 1 ? VIEW_W / 2 : (i / (n - 1)) * VIEW_W)
  const y = (v: number) => PAD_Y + (1 - Math.min(v, dataMax) / dataMax) * plotH
  const baseline = height - PAD_Y

  // Sparse x labels: first, last, and evenly spaced in between.
  const step = Math.max(1, Math.ceil(n / maxXLabels))
  const labelIdx = new Set<number>([0, n - 1])
  for (let i = 0; i < n; i += step) labelIdx.add(i)

  return (
    <div className={className}>
      {series.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-xs text-gx">
              <span className={clsx('w-2.5 h-2.5 rounded-full', TONE_TEXT[s.tone])} style={{ backgroundColor: 'currentColor' }} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </div>
      )}

      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={series.map((s) => `${s.label}: ${s.points.join(', ')}`).join('; ')}
      >
        {/* Mid gridline + baseline */}
        <line x1={0} y1={y(dataMax / 2)} x2={VIEW_W} y2={y(dataMax / 2)} className="text-gs/50" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
        <line x1={0} y1={baseline} x2={VIEW_W} y2={baseline} className="text-gs" stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" />

        {series.map((s) => {
          if (s.points.length === 0) return null
          const pts = s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')
          return (
            <g key={s.label} className={TONE_TEXT[s.tone]}>
              {s.area && (
                <polygon
                  points={`0,${baseline} ${pts} ${x(s.points.length - 1)},${baseline}`}
                  fill="currentColor"
                  className="opacity-10"
                />
              )}
              <polyline
                points={pts}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
      </svg>

      <div className="flex justify-between mt-1.5 text-[10px] text-gx">
        {labels.map((label, i) =>
          labelIdx.has(i) ? (
            <span key={i} className="tabular-nums">{label}</span>
          ) : null,
        )}
      </div>
    </div>
  )
}
