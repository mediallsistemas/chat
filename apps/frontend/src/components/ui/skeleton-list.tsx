export function SkeletonList({
  count = 3,
  height = 'h-16',
  className,
}: {
  count?: number
  height?: string
  className?: string
}) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${height} rounded-xl bg-gs/10 animate-pulse`} />
      ))}
    </div>
  )
}

export function SkeletonGrid({
  count = 4,
  className,
}: {
  count?: number
  className?: string
}) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${className ?? ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-gs/10 animate-pulse" />
      ))}
    </div>
  )
}
