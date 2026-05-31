'use client'

import { useToasts, dismissToast } from '@/hooks/use-toast'
import { clsx } from 'clsx'

export function ToastContainer() {
  const toasts = useToasts()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      role="region"
      aria-label="Notificações"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          aria-live={t.type === 'error' ? 'assertive' : 'polite'}
          className={clsx(
            'flex items-start gap-2 rounded-xl pl-4 pr-2 py-3 text-sm font-medium shadow-lg pointer-events-auto',
            t.type === 'error' && 'bg-red-600 text-white',
            t.type === 'success' && 'bg-green-600 text-white',
            t.type === 'warning' && 'bg-yellow-500 text-white',
          )}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            aria-label="Fechar notificação"
            className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
          >
            <i className="ti ti-x text-base" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
