'use client'

import { useInactivityTimeout } from '@/features/auth/hooks/use-inactivity-timeout'

export function InactivityGuard({ children }: { children: React.ReactNode }) {
  useInactivityTimeout()
  return <>{children}</>
}
