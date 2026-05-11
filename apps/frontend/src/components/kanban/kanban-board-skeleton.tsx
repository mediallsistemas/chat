export function KanbanBoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {[1, 2, 3, 4, 5].map((col) => (
        <div key={col} className="flex flex-col w-64 shrink-0 bg-page-bg rounded-2xl border border-gs/60 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-gs/60">
            <div className="h-4 w-24 rounded bg-gs animate-pulse" />
            <div className="h-5 w-5 rounded-full bg-gs animate-pulse" />
          </div>
          <div className="p-2 space-y-2 min-h-[120px]">
            {Array.from({ length: col === 2 ? 3 : col === 1 ? 2 : 1 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gs/60 p-3 space-y-2">
                <div className="h-3 w-16 rounded bg-gs animate-pulse" />
                <div className="h-4 w-full rounded bg-gs animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-gs animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
