import { Sidebar } from '@/shared/components/layout/sidebar'
import { Header } from '@/shared/components/layout/header'
import { RoleGuard } from '@/shared/components/layout/role-guard'
import { InstallPwaBanner } from '@/shared/components/pwa/install-prompt'
import { ToastContainer } from '@/shared/components/ui/toast-container'
import { SubscriptionStatusBanner } from '@/features/billing/components'
import { ImpersonationBanner } from '@/features/platform/components'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Full-width above everything — impersonation must be impossible to miss. */}
      <ImpersonationBanner />
      <div className="flex flex-1 min-h-0 bg-page-bg overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />
          <SubscriptionStatusBanner />
          <main className="flex-1 overflow-y-auto p-6">
            <RoleGuard>{children}</RoleGuard>
          </main>
        </div>
      </div>
      <InstallPwaBanner />
      <ToastContainer />
    </div>
  )
}
