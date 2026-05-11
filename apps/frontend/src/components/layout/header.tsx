'use client'

import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter, usePathname } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { useUnits } from '@/hooks/use-units'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationPanel } from '@/components/shared'
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
  const { units, activeUnit, switchUnit } = useUnits()
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
      setUser(null)
      router.push('/login')
    },
    onError: () => {
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

      {/* Unit selector — visible only for MULTI scope */}
      {user?.accessScope === AccessScope.MULTI && activeUnit && (
        <div className="relative" ref={unitMenuRef}>
          <button
            onClick={() => setUnitMenuOpen((v) => !v)}
            className="flex items-center gap-2 text-sm bg-page-bg hover:bg-gs/40 px-3 py-1.5 rounded-lg transition-colors border border-gs"
            aria-label="Selecionar unidade"
            aria-expanded={unitMenuOpen}
          >
            <i className="ti ti-building-hospital text-gd text-base" aria-hidden="true" />
            <span className="text-gray-500 text-xs">Acessando:</span>
            <span className="font-semibold text-gd text-sm">{activeUnit.name}</span>
            <i
              className={clsx('ti ti-chevron-down text-gx text-xs transition-transform', unitMenuOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {unitMenuOpen && (
            <div className="absolute left-0 top-full mt-1 min-w-[220px] bg-white border border-gs rounded-xl shadow-lg py-1 z-50">
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gx uppercase tracking-wider">
                Suas unidades
              </p>
              {units.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => {
                    switchUnit(unit)
                    setUnitMenuOpen(false)
                  }}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                    unit.id === activeUnit.id
                      ? 'bg-gd/5 text-gd font-semibold'
                      : 'text-gray-700 hover:bg-page-bg',
                  )}
                >
                  <i className="ti ti-building-hospital text-sm shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{unit.name}</span>
                  {unit.id === activeUnit.id && (
                    <i className="ti ti-check text-gd text-sm shrink-0" aria-hidden="true" />
                  )}
                </button>
              ))}
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
