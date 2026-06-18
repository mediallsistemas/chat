'use client'

import { useToasts } from '@/shared/hooks/use-toast'
import { clsx } from 'clsx'

export function ToastContainer() {
  const toasts = useToasts()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'rounded-xl px-4 py-3 text-sm font-medium shadow-lg pointer-events-auto animate-slide-up',
            t.type === 'error' && 'bg-red-600 text-white',
            t.type === 'success' && 'bg-green-600 text-white',
            t.type === 'warning' && 'bg-yellow-500 text-white',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
