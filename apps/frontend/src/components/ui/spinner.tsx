import { clsx } from 'clsx'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-4xl',
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <i
      className={clsx('ti ti-loader-2 animate-spin text-gx', SIZE[size], className)}
      aria-label="Carregando"
      role="status"
    />
  )
}
