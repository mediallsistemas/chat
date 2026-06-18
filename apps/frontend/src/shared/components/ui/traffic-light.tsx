import { clsx } from 'clsx'

export type TrafficLightStatus = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY'

interface TrafficLightProps {
  status: TrafficLightStatus
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const STATUS_CONFIG: Record<TrafficLightStatus, { dot: string; label: string; text: string }> = {
  GREEN:  { dot: 'bg-green-500',  label: 'No prazo',  text: 'text-green-600' },
  YELLOW: { dot: 'bg-yellow-400', label: 'Atenção',   text: 'text-yellow-600' },
  RED:    { dot: 'bg-red-500',    label: 'Atrasado',  text: 'text-red-500' },
  GRAY:   { dot: 'bg-gray-300',   label: 'Sem dados', text: 'text-gray-400' },
}

const DOT_SIZE = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3.5 h-3.5',
}

export function TrafficLight({ status, size = 'md', showLabel = false, className }: TrafficLightProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)}>
      <span
        className={clsx(
          'rounded-full shrink-0',
          DOT_SIZE[size],
          config.dot,
          status === 'RED' && 'animate-pulse-glow',
        )}
        aria-hidden="true"
      />
      {showLabel && (
        <span className={clsx('text-xs font-medium', config.text)}>
          {config.label}
        </span>
      )}
    </span>
  )
}
