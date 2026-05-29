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

function notify(toast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  toasts = [...toasts, { ...toast, id }]
  listeners.forEach((l) => l(toasts))
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    listeners.forEach((l) => l(toasts))
  }, 4000)
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
