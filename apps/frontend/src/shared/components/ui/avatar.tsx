import { clsx } from 'clsx'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-7 h-7 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-11 h-11 text-sm',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size]

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={clsx('rounded-full object-cover', sizeClass, className)}
      />
    )
  }

  return (
    <div
      className={clsx(
        'rounded-full bg-gd flex items-center justify-center text-gn font-bold font-sora select-none shrink-0',
        sizeClass,
        className,
      )}
      aria-label={name}
      title={name}
    >
      {getInitials(name)}
    </div>
  )
}
