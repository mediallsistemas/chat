export function PlanListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-1">
        <div className="h-3 w-12 rounded bg-gs animate-pulse" />
        <div className="h-6 w-6 rounded-lg bg-gs animate-pulse" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-gs/60 bg-white px-3 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-3 w-10 rounded bg-gs animate-pulse" />
            <div className="h-4 w-14 rounded-full bg-gs animate-pulse" />
          </div>
          <div className="h-3 w-full rounded bg-gs animate-pulse" />
          <div className="h-1.5 w-full rounded-full bg-gs animate-pulse mt-1" />
        </div>
      ))}
    </div>
  )
}

export function ObjectivesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-gs/60 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-page-bg">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-gs animate-pulse" />
              <div className="h-4 w-40 rounded bg-gs animate-pulse" />
            </div>
            <div className="h-3 w-16 rounded bg-gs animate-pulse" />
          </div>
          <div className="divide-y divide-gs/40">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3 px-4 py-3">
                <div className="h-4 w-4 rounded-full bg-gs animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-48 rounded bg-gs animate-pulse" />
                  <div className="h-2 w-24 rounded bg-gs animate-pulse" />
                </div>
                <div className="h-2 w-20 rounded-full bg-gs animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
