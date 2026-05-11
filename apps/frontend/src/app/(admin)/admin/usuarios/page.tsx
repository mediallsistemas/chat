'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/shared'
import { Button, Badge, Avatar, Modal } from '@/components/ui'
import { UserRole, AccessScope } from '@mediall/types'

interface User {
  id: string
  name: string
  email: string
  role: UserRole
  accessScope: AccessScope
  units: string[]
  isActive: boolean
  lastLogin: string
}

const MOCK_USERS: User[] = [
  { id: '1', name: 'Rafael Moreira', email: 'rafael@gmail.com', role: UserRole.SUPER_ADMIN, accessScope: AccessScope.GLOBAL, units: ['UEI', 'HRGM', 'HMMDO', 'HRPG', 'UPA'], isActive: true, lastLogin: 'Hoje' },
  { id: '2', name: 'Gabriel Araujo', email: 'gabriel@gmail.com', role: UserRole.DIRETORIA, accessScope: AccessScope.GLOBAL, units: ['UEI', 'HRGM', 'HMMDO', 'HRPG', 'UPA'], isActive: true, lastLogin: 'Hoje' },
  { id: '3', name: 'Diretor Operacional', email: 'diretor.operacional@mediall.com.br', role: UserRole.DIRETORIA, accessScope: AccessScope.GLOBAL, units: ['UEI', 'HRGM', 'HMMDO', 'HRPG', 'UPA'], isActive: true, lastLogin: 'Ontem' },
  { id: '4', name: 'Diretor Financeiro', email: 'diretor.financeiro@mediall.com.br', role: UserRole.DIRETORIA, accessScope: AccessScope.MULTI, units: ['UEI', 'HRGM'], isActive: true, lastLogin: '2d atrás' },
  { id: '5', name: 'Gerente CCIH', email: 'gerente.ccih@mediall.com.br', role: UserRole.GESTOR, accessScope: AccessScope.MULTI, units: ['HMMDO', 'HRPG'], isActive: true, lastLogin: '3d atrás' },
  { id: '6', name: 'Gerente de Enfermagem', email: 'gerente.enfermagem@mediall.com.br', role: UserRole.GESTOR, accessScope: AccessScope.SINGLE, units: ['UEI'], isActive: true, lastLogin: 'Hoje' },
  { id: '7', name: 'Gerente Pronto Socorro', email: 'gerente.ps@mediall.com.br', role: UserRole.GESTOR, accessScope: AccessScope.SINGLE, units: ['HRGM'], isActive: false, lastLogin: '15d atrás' },
]

const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Super Admin',
  [UserRole.DIRETORIA]: 'Diretoria',
  [UserRole.GESTOR]: 'Gestor',
  [UserRole.COLABORADOR]: 'Colaborador',
  [UserRole.VISUALIZADOR]: 'Visualizador',
}

const SCOPE_LABEL: Record<AccessScope, string> = {
  [AccessScope.GLOBAL]: 'Global',
  [AccessScope.MULTI]: 'Multi',
  [AccessScope.SINGLE]: 'Único',
}

export default function UsuariosPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL')
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = MOCK_USERS.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <PageHeader
        title="Usuários"
        action={
          <Button onClick={() => setModalOpen(true)}>
            <i className="ti ti-user-plus text-sm" aria-hidden="true" />
            Novo usuário
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gx text-sm" aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gs rounded-xl focus:outline-none focus:border-gd focus:ring-1 focus:ring-gd/20"
            aria-label="Buscar usuário"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')}
          className="text-sm bg-white border border-gs rounded-xl px-3 py-2 focus:outline-none focus:border-gd text-gray-700"
          aria-label="Filtrar por papel"
        >
          <option value="ALL">Todos os papéis</option>
          {Object.values(UserRole).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gs/60 bg-page-bg">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gx uppercase tracking-wide">Usuário</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gx uppercase tracking-wide hidden md:table-cell">Papel</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gx uppercase tracking-wide hidden lg:table-cell">Unidades</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gx uppercase tracking-wide hidden xl:table-cell">Escopo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gx uppercase tracking-wide hidden lg:table-cell">Último acesso</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gx uppercase tracking-wide">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gs/40">
            {filtered.map((user) => (
              <tr key={user.id} className="hover:bg-page-bg/50 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} size="sm" />
                    <div>
                      <p className="font-medium text-gray-800">{user.name}</p>
                      <p className="text-xs text-gx">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <Badge label={ROLE_LABEL[user.role]} variant="role" value={user.role} />
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {user.units.slice(0, 3).map((u) => (
                      <span key={u} className="text-[11px] bg-page-bg text-gx px-1.5 py-0.5 rounded font-medium">
                        {u}
                      </span>
                    ))}
                    {user.units.length > 3 && (
                      <span className="text-[11px] text-gx">+{user.units.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 hidden xl:table-cell">
                  <Badge label={SCOPE_LABEL[user.accessScope]} variant="scope" value={user.accessScope} />
                </td>
                <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-gx">
                  {user.lastLogin}
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                      user.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    <span className={clsx('w-1.5 h-1.5 rounded-full', user.isActive ? 'bg-green-500' : 'bg-gray-400')} />
                    {user.isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <button
                    className="p-1.5 rounded-lg text-gx hover:bg-page-bg hover:text-gray-800 transition-colors"
                    aria-label={`Ações para ${user.name}`}
                  >
                    <i className="ti ti-dots-vertical text-base" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <i className="ti ti-users-off text-3xl text-gx mb-2 block" aria-hidden="true" />
            <p className="text-sm text-gx">Nenhum usuário encontrado</p>
          </div>
        )}
      </div>

      {/* New user modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo usuário" size="md">
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-gray-700 mb-1">
                Nome completo
              </label>
              <input
                id="name"
                type="text"
                placeholder="Nome do usuário"
                className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd focus:ring-1 focus:ring-gd/20"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                placeholder="usuario@mediall.com.br"
                className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd focus:ring-1 focus:ring-gd/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-700 mb-1">
              Senha inicial
            </label>
            <input
              id="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd focus:ring-1 focus:ring-gd/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="role" className="block text-xs font-semibold text-gray-700 mb-1">
                Papel
              </label>
              <select
                id="role"
                className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd text-gray-700"
              >
                {Object.values(UserRole).map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="scope" className="block text-xs font-semibold text-gray-700 mb-1">
                Escopo de acesso
              </label>
              <select
                id="scope"
                className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd text-gray-700"
              >
                {Object.values(AccessScope).map((s) => (
                  <option key={s} value={s}>{SCOPE_LABEL[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">Unidades</p>
            <div className="grid grid-cols-3 gap-2">
              {['UEI', 'HRGM', 'HMMDO', 'HRPG', 'UPA Zona Sul'].map((unit) => (
                <label key={unit} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded border-gs accent-gd"
                  />
                  <span className="text-xs text-gray-700">{unit}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gs/60">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              Criar usuário
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
