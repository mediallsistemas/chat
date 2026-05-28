'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { UserRole } from '@mediall/types'
import { clsx } from 'clsx'

// Convention: `roles: null` means "everyone". Otherwise, only listed
// roles see the item. Order here is the order shown in the sidebar.
const navItems: Array<{
  href: string
  icon: string
  label: string
  roles: UserRole[] | null
}> = [
  // Colaborador / Visualizador get a focused home
  {
    href: '/meu',
    icon: 'ti-home',
    label: 'Minha visão',
    roles: [UserRole.COLABORADOR, UserRole.VISUALIZADOR],
  },

  // Chat is universal — every role has access to their groups
  { href: '/mensagens', icon: 'ti-message-2', label: 'Mensagens', roles: null },

  // Diretoria / SUPER_ADMIN-only painel
  {
    href: '/dashboard',
    icon: 'ti-layout-dashboard',
    label: 'Painel',
    roles: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA],
  },

  // Gestor + admin
  {
    href: '/processos',
    icon: 'ti-sitemap',
    label: 'Processos',
    roles: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR],
  },
  {
    href: '/kanban',
    icon: 'ti-layout-kanban',
    label: 'Kanban',
    roles: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR],
  },
  {
    href: '/impedimentos',
    icon: 'ti-alert-triangle',
    label: 'Impedimentos',
    roles: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR],
  },
  {
    href: '/reunioes',
    icon: 'ti-video',
    label: 'Reuniões',
    roles: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR],
  },
  {
    href: '/arquivos',
    icon: 'ti-folder',
    label: 'Arquivos',
    roles: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR],
  },
  {
    href: '/documentos',
    icon: 'ti-file-text',
    label: 'Documentos',
    roles: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR],
  },
  {
    href: '/chamados',
    icon: 'ti-ticket',
    label: 'Chamados',
    roles: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR],
  },

  // Personal settings — available to everyone
  {
    href: '/configuracoes/notificacoes',
    icon: 'ti-bell-cog',
    label: 'Notificações',
    roles: null,
  },

  // Admin-only
  {
    href: '/admin/usuarios',
    icon: 'ti-users',
    label: 'Usuários',
    roles: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA],
  },
  {
    href: '/admin/auditoria',
    icon: 'ti-list-search',
    label: 'Auditoria',
    roles: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA],
  },
]

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function Sidebar() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  )

  return (
    <aside className="w-[52px] min-h-screen flex flex-col shrink-0 bg-gd">
      {/* Logo mark */}
      <div className="h-[52px] flex items-center justify-center shrink-0 border-b border-white/10">
        <span className="text-gn font-bold text-xl font-sora leading-none">M</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 px-1.5 py-3" aria-label="Navegação principal">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={clsx(
                'flex items-center justify-center h-10 w-full rounded-lg transition-colors',
                isActive ? 'sidebar-active' : 'sidebar-item',
              )}
            >
              <i className={`ti ${item.icon} text-[20px] leading-none`} aria-hidden="true" />
            </Link>
          )
        })}
      </nav>

      {/* User avatar */}
      <div className="pb-3 flex justify-center">
        <div
          className="w-9 h-9 rounded-full bg-gn flex items-center justify-center text-gd text-[11px] font-bold font-sora cursor-pointer select-none overflow-hidden"
          title={user?.name ?? 'Usuário'}
          aria-label={`Usuário: ${user?.name ?? ''}`}
        >
          {user?.avatarUrl
            ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            : (user ? getInitials(user.name) : '?')}
        </div>
      </div>
    </aside>
  )
}
