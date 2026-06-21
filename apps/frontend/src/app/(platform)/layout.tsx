'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/shared/components/layout/sidebar'
import { Header } from '@/shared/components/layout/header'
import { ToastContainer } from '@/shared/components/ui/toast-container'
import { Spinner } from '@/shared/components/ui'
import { useAuth } from '@/features/auth/hooks/use-auth'

/**
 * Platform-admin shell (plano 26.5). The real authorization is the backend
 * `PlatformAdminGuard`; this is a client-side gate that redirects non-platform
 * users away (UI only — esconder não é segurança, ui.md §9). In production the
 * platform panel is also host-gated (admin.app.com).
 */
export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user && !user.isPlatformAdmin) {
      router.replace('/dashboard')
    }
  }, [isLoading, user, router])

  if (isLoading || !user || !user.isPlatformAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-page-bg">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-page-bg overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <ToastContainer />
    </div>
  )
}
