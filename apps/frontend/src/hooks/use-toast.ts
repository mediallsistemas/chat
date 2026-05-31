'use client'

import { useState, useEffect } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning'
}

type Listener = (toasts: Toast[]) => void

let listeners: Listener[] = []
let toasts: Toast[] = []

// Errors stay longer so users can read/act before auto-dismiss.
const DURATION: Record<Toast['type'], number> = {
  success: 4000,
  warning: 6000,
  error: 8000,
}

function emit() {
  listeners.forEach((l) => l(toasts))
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

function notify(toast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  toasts = [...toasts, { ...toast, id }]
  emit()
  setTimeout(() => dismissToast(id), DURATION[toast.type])
}

export const toast = {
  success: (message: string) => notify({ message, type: 'success' }),
  error: (message: string) => notify({ message, type: 'error' }),
  warning: (message: string) => notify({ message, type: 'warning' }),
}

export function useToasts() {
  const [state, setState] = useState<Toast[]>(toasts)
  useEffect(() => {
    listeners.push(setState)
    return () => {
      listeners = listeners.filter((l) => l !== setState)
    }
  }, [])
  return state
}
