'use client'

import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api, invalidateCsrfToken } from '@/shared/lib/api'
import { useAuthStore } from '@/features/auth/store/auth-store'

/**
 * Visible, always-on banner shown while a platform admin is impersonating a
 * tenant (plano 26.5). Impersonation is powerful and audited — the operator must
 * never forget they are acting as someone else. "Sair" logs out; the admin then
 * re-authenticates as themselves (the impersonation replaced the auth cookie).
 */
export function ImpersonationBanner() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const tenantName = useAuthStore((s) => s.user?.impersonatedTenantName)

  function endImpersonation() {
    invalidateCsrfToken()
    setUser(null)
    router.push('/login')
  }

  const { mutate: exit, isPending } = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: endImpersonation,
    onError: endImpersonation,
  })

  if (!tenantName) return null

  return (
    <div
      role="alert"
      className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-1.5 text-sm font-medium text-amber-950"
    >
      <i className="ti ti-user-shield text-base shrink-0" aria-hidden="true" />
      <span>
        Você está impersonando <strong>{tenantName}</strong> — todas as ações ficam registradas na
        auditoria.
      </span>
      <button
        type="button"
        onClick={() => exit()}
        disabled={isPending}
        className="ml-2 shrink-0 font-semibold underline hover:no-underline disabled:opacity-60"
      >
        Sair da impersonação
      </button>
    </div>
  )
}
