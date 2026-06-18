'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { UserRole } from '@mediall/types'
import { clsx } from 'clsx'

type NavItem = {
  href: string
  icon: string
  label: string
  roles: UserRole[] | null
}

type NavGroup = {
  id: string
  label: string
  icon: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    id: 'estrategia',
    label: 'Estratégia & Execução',
    icon: 'ti-target-arrow',
    items: [
      {
        href: '/dashboard',
        icon: 'ti-layout-dashboard',
        label: 'Painel',
        roles: [UserRole.SUPER_ADMIN, UserRole.DIRETORIA],
      },
      { href: '/processos', icon: 'ti-sitemap', label: 'Processos', roles: null },
      { href: '/processos/painel', icon: 'ti-report-analytics', label: 'Painel Estratégico', roles: null },
      { href: '/kanban', icon: 'ti-layout-kanban', label: 'Kanban', roles: null },
      { href: '/impedimentos', icon: 'ti-alert-triangle', label: 'Impedimentos', roles: null },
    ],
  },
  {
    id: 'comunicacao',
    label: 'Comunicação',
    icon: 'ti-messages',
    items: [
      { href: '/mensagens', icon: 'ti-message-2', label: 'Mensagens', roles: null },
      { href: '/reunioes', icon: 'ti-video', label: 'Reuniões', roles: null },
    ],
  },
  {
    id: 'conhecimento',
    label: 'Conhecimento',
    icon: 'ti-books',
    items: [
      { href: '/arquivos', icon: 'ti-folder', label: 'Arquivos', roles: null },
      { href: '/documentos', icon: 'ti-file-text', label: 'Documentos', roles: null },
    ],
  },
  {
    id: 'suporte',
    label: 'Suporte & Admin',
    icon: 'ti-settings',
    items: [
      { href: '/chamados', icon: 'ti-ticket', label: 'Chamados', roles: null },
      { href: '/configuracoes/notificacoes', icon: 'ti-bell-cog', label: 'Notificações', roles: null },
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
    ],
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

function isItemActive(itemHref: string, pathname: string): boolean {
  if (itemHref === '/processos') return pathname === '/processos'
  return pathname === itemHref || pathname.startsWith(itemHref + '/')
}

export function Sidebar() {
  const pathname = usePathname()
  const user = useAuthStore((s) => s.user)
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimerRef.current = setTimeout(() => setOpenGroupId(null), 150)
  }

  const handleOpen = (id: string) => {
    cancelClose()
    setOpenGroupId(id)
  }

  useEffect(() => cancelClose, [])

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || (user && item.roles.includes(user.role)),
      ),
    }))
    .filter((group) => group.items.length > 0)

  const activeGroup = visibleGroups.find((g) =>
    g.items.some((item) => isItemActive(item.href, pathname)),
  )
  const activeGroupId = activeGroup?.id ?? null

  // Close flyout on outside click or Esc
  useEffect(() => {
    if (!openGroupId) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenGroupId(null)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroupId(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [openGroupId])

  // Close flyout on navigation
  useEffect(() => {
    setOpenGroupId(null)
  }, [pathname])

  return (
    <div ref={containerRef} className="relative flex shrink-0">
      <aside className="w-[52px] min-h-screen flex flex-col shrink-0 bg-gd">
        {/* Logo mark */}
        <div className="h-[52px] flex items-center justify-center shrink-0 border-b border-white/10">
          <span className="text-gn font-bold text-xl font-sora leading-none">M</span>
        </div>

        {/* Module icons */}
        <nav className="flex-1 flex flex-col gap-1 px-1.5 py-3" aria-label="Navegação principal">
          {visibleGroups.map((group) => {
            const isActive = activeGroupId === group.id
            const isOpen = openGroupId === group.id
            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  aria-label={group.label}
                  aria-expanded={isOpen}
                  title={group.label}
                  onMouseEnter={() => handleOpen(group.id)}
                  onMouseLeave={scheduleClose}
                  onFocus={() => handleOpen(group.id)}
                  onBlur={scheduleClose}
                  className={clsx(
                    'flex items-center justify-center h-10 w-full rounded-lg transition-all duration-200',
                    isActive || isOpen
                      ? 'bg-[#BFEF45]/15 text-[#BFEF45]'
                      : 'text-white/55 hover:bg-white/10 hover:text-white/90',
                    isActive && 'shadow-glow-sm',
                  )}
                >
                  <i className={`ti ${group.icon} text-[20px] leading-none`} aria-hidden="true" />
                </button>

                {isOpen && (
                  <div
                    className="absolute left-full top-0 ml-1.5 z-50 w-56 bg-gd border border-white/10 rounded-lg shadow-2xl py-2 animate-slide-in-left"
                    role="menu"
                    aria-label={group.label}
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                  >
                    <div className="px-3 pb-2 mb-1 border-b border-white/10">
                      <span className="text-white/60 text-[11px] font-semibold uppercase tracking-wider font-sora">
                        {group.label}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 px-1.5">
                      {group.items.map((item) => {
                        const itemActive = isItemActive(item.href, pathname)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            role="menuitem"
                            className={clsx(
                              'flex items-center gap-3 h-9 px-2.5 rounded-md transition-colors text-sm',
                              itemActive
                                ? 'bg-[#BFEF45]/15 text-[#BFEF45]'
                                : 'text-white/70 hover:bg-white/10 hover:text-white',
                            )}
                          >
                            <i className={`ti ${item.icon} text-[16px] leading-none shrink-0`} aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
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
    </div>
  )
}
