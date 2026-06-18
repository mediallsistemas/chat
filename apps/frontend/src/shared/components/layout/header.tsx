'use client'

import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter, usePathname } from 'next/navigation'
import { api, invalidateCsrfToken } from '@/shared/lib/api'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { useUnits } from '@/features/units/hooks/use-units'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'
import { NotificationPanel } from '@/shared/components'
import { AccessScope } from '@mediall/types'
import { clsx } from 'clsx'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Painel da Diretoria',
  '/processos': 'Planos Estratégicos',
  '/kanban': 'Kanban',
  '/mensagens': 'Mensagens',
  '/agenda': 'Agenda',
  '/arquivos': 'Arquivos',
  '/admin/usuarios': 'Usuários',
  '/admin/unidades': 'Unidades',
}

function getPageTitle(pathname: string): string {
  const match = Object.keys(PAGE_TITLES).find((key) => pathname.startsWith(key))
  return match ? PAGE_TITLES[match] : 'Mediall Brasil'
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, setUser } = useAuthStore()
  const { units, activeUnit, scope, switchUnit, switchToHolding } = useUnits()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [unitMenuOpen, setUnitMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const { unreadCount } = useNotifications()
  const unitMenuRef = useRef<HTMLDivElement>(null)

  // Close unit menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (unitMenuRef.current && !unitMenuRef.current.contains(e.target as Node)) {
        setUnitMenuOpen(false)
      }
    }
    if (unitMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [unitMenuOpen])

  const { mutate: logout } = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      invalidateCsrfToken()
      setUser(null)
      router.push('/login')
    },
    onError: () => {
      invalidateCsrfToken()
      setUser(null)
      router.push('/login')
    },
  })

  return (
    <header className="h-14 bg-white border-b border-gs flex items-center justify-between px-5 shrink-0 z-10">
      {/* Page title */}
      <h1 className="text-[15px] font-semibold text-gray-800 font-sora">
        {getPageTitle(pathname)}
      </h1>

      {/* Scope selector — visible for MULTI and GLOBAL (plano 25). GLOBAL also gets the
          aggregated "toda a holding" option; SINGLE lands in its only unit, no selector. */}
      {(user?.accessScope === AccessScope.MULTI || user?.accessScope === AccessScope.GLOBAL) && (
        <div className="relative" ref={unitMenuRef}>
          <button
            onClick={() => setUnitMenuOpen((v) => !v)}
            className="flex items-center gap-2 text-sm bg-page-bg hover:bg-gs/40 px-3 py-1.5 rounded-lg transition-colors border border-gs"
            aria-label="Selecionar escopo"
            aria-expanded={unitMenuOpen}
          >
            <i
              className={clsx('text-gd text-base', scope === 'ALL' ? 'ti ti-buildings' : 'ti ti-building-hospital')}
              aria-hidden="true"
            />
            <span className="text-gray-500 text-xs">Acessando:</span>
            <span className="font-semibold text-gd text-sm max-w-[160px] truncate">
              {scope === 'ALL' ? 'Toda a holding' : (activeUnit?.name ?? 'Selecione')}
            </span>
            <i
              className={clsx('ti ti-chevron-down text-gx text-xs transition-transform', unitMenuOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {unitMenuOpen && (
            <div className="absolute left-0 top-full mt-1 min-w-[240px] bg-white border border-gs rounded-xl shadow-lg py-1 z-50">
              {/* Aggregated holding scope */}
              <button
                onClick={() => {
                  switchToHolding()
                  setUnitMenuOpen(false)
                }}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                  scope === 'ALL'
                    ? 'bg-gd/5 text-gd font-semibold'
                    : 'text-gray-700 hover:bg-page-bg',
                )}
              >
                <i className="ti ti-buildings text-base shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">Toda a holding</span>
                {scope === 'ALL' && <i className="ti ti-check text-gd text-sm shrink-0" aria-hidden="true" />}
              </button>

              <div className="my-1 border-t border-gs/60" />

              <p className="px-3 pt-1 pb-1 text-[10px] font-semibold text-gx uppercase tracking-wider">
                {user?.accessScope === AccessScope.GLOBAL ? 'Unidades' : 'Suas unidades'}
              </p>
              {units.map((unit) => {
                const isActive = scope === 'UNIT' && unit.id === activeUnit?.id
                return (
                  <button
                    key={unit.id}
                    onClick={() => {
                      switchUnit(unit)
                      setUnitMenuOpen(false)
                    }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                      isActive ? 'bg-gd/5 text-gd font-semibold' : 'text-gray-700 hover:bg-page-bg',
                    )}
                  >
                    <i className="ti ti-building-hospital text-sm shrink-0" aria-hidden="true" />
                    <span className="flex-1 truncate">{unit.name}</span>
                    {isActive && <i className="ti ti-check text-gd text-sm shrink-0" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notificações"
            aria-expanded={notifOpen}
            className="relative p-2 rounded-lg hover:bg-page-bg text-gx hover:text-gd transition-colors"
          >
            <i className="ti ti-bell text-[18px]" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)} />}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-lg hover:bg-page-bg transition-colors"
            aria-label="Menu do usuário"
            aria-expanded={userMenuOpen}
          >
            <div className="w-7 h-7 rounded-full bg-gd flex items-center justify-center text-gn text-[11px] font-bold font-sora select-none overflow-hidden">
              {user?.avatarUrl
                ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                : (user ? getInitials(user.name) : '?')}
            </div>
            <span className="text-sm text-gray-700 hidden sm:block max-w-[120px] truncate">
              {user?.name}
            </span>
            <i
              className={clsx('ti ti-chevron-down text-gx text-xs transition-transform', userMenuOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gs rounded-xl shadow-lg py-1 z-50">
              <div className="px-3 py-2 border-b border-gs">
                <p className="text-xs font-semibold text-gray-800 truncate">{user?.name}</p>
                <p className="text-[11px] text-gx truncate">{user?.email}</p>
              </div>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-page-bg hover:text-gray-900 transition-colors"
                onClick={() => router.push('/perfil')}
              >
                <i className="ti ti-user text-base" aria-hidden="true" />
                Meu perfil
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                onClick={() => logout()}
              >
                <i className="ti ti-logout text-base" aria-hidden="true" />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
