import { clsx } from 'clsx'

interface MetricCardProps {
  label: string
  value: string | number
  icon: string
  trend?: { value: number; label: string }
  iconColor?: string
  className?: string
}

export function MetricCard({ label, value, icon, trend, iconColor = 'text-gd', className }: MetricCardProps) {
  const trendPositive = trend && trend.value >= 0

  return (
    <div className={clsx('bg-white rounded-2xl p-5 border border-gs/60', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gx font-medium uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-gray-900 font-sora mt-1">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-page-bg flex items-center justify-center shrink-0">
          <i className={clsx(`ti ${icon} text-xl`, iconColor)} aria-hidden="true" />
        </div>
      </div>

      {trend && (
        <div className={clsx('flex items-center gap-1 mt-3 text-xs font-medium', trendPositive ? 'text-green-600' : 'text-red-500')}>
          <i className={clsx('ti text-sm', trendPositive ? 'ti-trending-up' : 'ti-trending-down')} aria-hidden="true" />
          <span>{trend.value > 0 ? '+' : ''}{trend.value}% {trend.label}</span>
        </div>
      )}
    </div>
  )
}
