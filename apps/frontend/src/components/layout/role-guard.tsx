'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { UserRole } from '@mediall/types'

// Routes a colaborador / visualizador should NEVER reach by URL typing.
// Order matters only for prefix matching: longer paths first if needed.
const RESTRICTED_PREFIXES = [
  '/dashboard',
  '/processos',
  '/kanban',
  '/impedimentos',
  '/reunioes',
  '/arquivos',
  '/documentos',
  '/chamados',
  '/admin',
]

const RESTRICTED_ROLES: UserRole[] = [UserRole.COLABORADOR, UserRole.VISUALIZADOR]

/**
 * Redirects colaborador/visualizador away from routes they shouldn't see.
 * Renders nothing while the redirect is in flight; otherwise returns
 * children. Keep this lightweight — it runs on every route change.
 */
export function RoleGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoading } = useAuth()

  const blocked =
    !!user &&
    RESTRICTED_ROLES.includes(user.role) &&
    RESTRICTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))

  useEffect(() => {
    if (blocked) router.replace('/meu')
  }, [blocked, router])

  // Don't render restricted content before we know who the user is —
  // otherwise it flashes for a frame before the redirect fires.
  if (!user && isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <i className="ti ti-loader-2 animate-spin text-2xl text-gx" aria-hidden="true" />
      </div>
    )
  }

  if (blocked) return null
  return <>{children}</>
}
