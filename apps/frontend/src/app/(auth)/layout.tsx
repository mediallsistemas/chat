import { Sidebar } from '@/shared/components/layout/sidebar'
import { Header } from '@/shared/components/layout/header'
import { RoleGuard } from '@/shared/components/layout/role-guard'
import { InstallPwaBanner } from '@/shared/components/pwa/install-prompt'
import { ToastContainer } from '@/shared/components/ui/toast-container'
import { SubscriptionStatusBanner } from '@/features/billing/components'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-page-bg overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <SubscriptionStatusBanner />
        <main className="flex-1 overflow-y-auto p-6">
          <RoleGuard>{children}</RoleGuard>
        </main>
      </div>
      <InstallPwaBanner />
      <ToastContainer />
    </div>
  )
}
