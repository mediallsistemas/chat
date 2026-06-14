'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { api, invalidateCsrfToken } from '@/shared/lib/api'
import { useAuthStore } from '@/features/auth/store/auth-store'

const INACTIVITY_MS = 7 * 60 * 60 * 1000 // 7 hours
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click']

export function useInactivityTimeout() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore — we're logging out anyway
    }
    invalidateCsrfToken()
    setUser(null)
    router.push('/login')
  }, [router, setUser])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(logout, INACTIVITY_MS)
  }, [logout])

  useEffect(() => {
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer])
}
