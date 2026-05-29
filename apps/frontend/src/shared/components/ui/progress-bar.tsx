import { clsx } from 'clsx'

interface ProgressBarProps {
  value: number
  max?: number
  color?: 'green' | 'yellow' | 'red' | 'brand'
  size?: 'sm' | 'md'
  showLabel?: boolean
  className?: string
}

const COLOR_CLASSES = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  brand: 'bg-gn',
}

export function ProgressBar({
  value,
  max = 100,
  color = 'brand',
  size = 'md',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const autoColor = pct >= 70 ? 'green' : pct >= 40 ? 'yellow' : 'red'
  const barColor = color === 'brand' ? 'brand' : color

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div
        className={clsx(
          'flex-1 bg-gs rounded-full overflow-hidden',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={clsx('h-full rounded-full transition-all duration-300', COLOR_CLASSES[barColor === 'brand' ? autoColor : barColor])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-gx font-medium w-9 text-right shrink-0">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  )
}
