'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
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
  const user = useAuthStore((s) => s.user)

  const blocked =
    !!user &&
    RESTRICTED_ROLES.includes(user.role) &&
    RESTRICTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))

  useEffect(() => {
    if (blocked) router.replace('/meu')
  }, [blocked, router])

  if (blocked) return null
  return <>{children}</>
}
