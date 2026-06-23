import { clsx } from 'clsx'
import type { ChartTone } from './donut-chart'

const TONE_BG: Record<ChartTone, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  gray: 'bg-gs',
  brand: 'bg-gd',
  lime: 'bg-gn',
}

export interface BarChartItem {
  label: string
  value: number
  tone?: ChartTone
  /** Optional secondary text shown under the label (e.g. "3 planos"). */
  hint?: string
}

interface BarChartProps {
  items: BarChartItem[]
  /** Upper bound for the bars. Defaults to the largest value (min 1). */
  max?: number
  /** Render the trailing value. Defaults to the raw number. */
  formatValue?: (value: number) => string
  emptyLabel?: string
  className?: string
}

/**
 * Horizontal ranked bars (no chart lib — ui.md §2). Token-colored via the tone →
 * bg-color map; same visual language as ProgressBar / group-activity mini-bars.
 */
export function BarChart({
  items,
  max,
  formatValue = (v) => String(v),
  emptyLabel = 'Sem dados.',
  className,
}: BarChartProps) {
  if (items.length === 0) {
    return <p className="text-xs text-gx px-1 py-4">{emptyLabel}</p>
  }

  const ceiling = Math.max(1, max ?? Math.max(...items.map((i) => i.value)))

  return (
    <ul className={clsx('space-y-2.5', className)}>
      {items.map((item) => {
        const pct = Math.min(100, Math.max(0, (item.value / ceiling) * 100))
        return (
          <li key={item.label} className="flex items-center gap-3">
            <div className="w-32 shrink-0 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
              {item.hint && <p className="text-[11px] text-gx truncate">{item.hint}</p>}
            </div>
            <div
              className="flex-1 h-2.5 rounded-full bg-page-bg overflow-hidden"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={item.label}
            >
              <div
                className={clsx('h-full rounded-full transition-all duration-500', TONE_BG[item.tone ?? 'brand'])}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-xs text-gx font-medium tabular-nums">
              {formatValue(item.value)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
