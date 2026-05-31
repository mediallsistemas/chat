'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { useUIStore } from '@/store/ui-store'
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
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  )

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname, setSidebarOpen])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const userAvatar = (
    <div className="w-9 h-9 rounded-full bg-gn flex items-center justify-center text-gd text-[11px] font-bold font-sora select-none overflow-hidden shrink-0">
      {user?.avatarUrl
        ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        : (user ? getInitials(user.name) : '?')}
    </div>
  )

  return (
    <>
      {/* Desktop icon rail */}
      <aside className="hidden md:flex w-[52px] min-h-screen flex-col shrink-0 bg-gd">
        <div className="h-[52px] flex items-center justify-center shrink-0 border-b border-white/10">
          <span className="text-gn font-bold text-xl font-sora leading-none">M</span>
        </div>

        <nav className="flex-1 flex flex-col gap-0.5 px-1.5 py-3" aria-label="Navegação principal">
          {visibleItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={clsx(
                'flex items-center justify-center h-10 w-full rounded-lg transition-colors',
                isActive(item.href) ? 'sidebar-active' : 'sidebar-item',
              )}
            >
              <i className={`ti ${item.icon} text-[20px] leading-none`} aria-hidden="true" />
            </Link>
          ))}
        </nav>

        <div className="pb-3 flex justify-center" title={user?.name ?? 'Usuário'} aria-label={`Usuário: ${user?.name ?? ''}`}>
          {userAvatar}
        </div>
      </aside>

      {/* Mobile drawer + backdrop */}
      <div
        className={clsx(
          'md:hidden fixed inset-0 z-50 transition-opacity duration-200',
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden={!sidebarOpen}
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
        <aside
          className={clsx(
            'absolute inset-y-0 left-0 w-64 bg-gd flex flex-col transition-transform duration-200',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-label="Navegação principal"
        >
          <div className="h-[52px] flex items-center justify-between px-4 shrink-0 border-b border-white/10">
            <span className="text-gn font-bold text-xl font-sora leading-none">Mediall</span>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Fechar menu"
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <i className="ti ti-x text-lg" aria-hidden="true" />
            </button>
          </div>

          <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3 overflow-y-auto">
            {visibleItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={clsx(
                  'flex items-center gap-3 h-11 px-3 rounded-lg text-sm transition-colors',
                  isActive(item.href) ? 'sidebar-active' : 'sidebar-item',
                )}
              >
                <i className={`ti ${item.icon} text-[20px] leading-none shrink-0`} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 px-4 py-3 border-t border-white/10">
            {userAvatar}
            <span className="text-sm text-white/90 truncate">{user?.name ?? ''}</span>
          </div>
        </aside>
      </div>
    </>
  )
}
