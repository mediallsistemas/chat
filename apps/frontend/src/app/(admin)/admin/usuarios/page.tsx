'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader } from '@/shared/components'
import { Button, Badge, Avatar, Modal, SkeletonList } from '@/shared/components/ui'
import { UserRole, AccessScope } from '@mediall/types'
import { useUsers, useCreateUser, useUpdateUser, useUnlockUser, type UserListItem } from '@/features/users/hooks/use-users'

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

const createSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  accessScope: z.nativeEnum(AccessScope),
})

type CreateForm = z.infer<typeof createSchema>

function lastSeenLabel(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Nunca'
  return formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true, locale: ptBR })
}

function UserRow({ user }: { user: UserListItem }) {
  const { mutate: updateUser } = useUpdateUser(user.id)
  const { mutate: unlockUser } = useUnlockUser()

  const primaryRole = user.unitAccess.find((u) => u.isPrimary)?.role ?? user.unitAccess[0]?.role

  return (
    <tr className="hover:bg-page-bg/50 transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} src={user.avatarUrl ?? undefined} size="sm" />
          <div>
            <p className="font-medium text-gray-800">{user.name}</p>
            <p className="text-xs text-gx">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3.5 hidden md:table-cell">
        {primaryRole ? (
          <Badge label={ROLE_LABEL[primaryRole]} variant="role" value={primaryRole} />
        ) : (
          <span className="text-xs text-gx">—</span>
        )}
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell">
        <div className="flex flex-wrap gap-1">
          {user.unitAccess.slice(0, 3).map((ua) => (
            <span key={ua.unitId} className="text-[11px] bg-page-bg text-gx px-1.5 py-0.5 rounded font-medium">
              {ua.unit.name}
            </span>
          ))}
          {user.unitAccess.length > 3 && (
            <span className="text-[11px] text-gx">+{user.unitAccess.length - 3}</span>
          )}
          {user.unitAccess.length === 0 && <span className="text-[11px] text-gx">—</span>}
        </div>
      </td>
      <td className="px-4 py-3.5 hidden xl:table-cell">
        <Badge label={SCOPE_LABEL[user.accessScope]} variant="scope" value={user.accessScope} />
      </td>
      <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-gx">
        {lastSeenLabel(user.lastSeenAt)}
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
        <div className="flex items-center gap-1">
          {!user.isActive && (
            <button
              onClick={() => unlockUser(user.id)}
              className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
              aria-label={`Desbloquear ${user.name}`}
              title="Desbloquear conta"
            >
              <i className="ti ti-lock-open text-base" aria-hidden="true" />
            </button>
          )}
          <button
            onClick={() => updateUser({ isActive: !user.isActive })}
            className="p-1.5 rounded-lg text-gx hover:bg-page-bg hover:text-gray-800 transition-colors"
            aria-label={user.isActive ? `Desativar ${user.name}` : `Ativar ${user.name}`}
            title={user.isActive ? 'Desativar' : 'Ativar'}
          >
            <i className={clsx('ti text-base', user.isActive ? 'ti-user-off' : 'ti-user-check')} aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function UsuariosPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const searchTimerRef = { current: null as ReturnType<typeof setTimeout> | null }

  const { data, isLoading } = useUsers({ search: debouncedSearch || undefined, limit: 100 })
  const { mutate: createUser, isPending: creating } = useCreateUser()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({ resolver: zodResolver(createSchema), defaultValues: { accessScope: AccessScope.SINGLE } })

  function onSearchChange(value: string) {
    setSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  function onSubmit(values: CreateForm) {
    createUser(values, {
      onSuccess: () => {
        reset()
        setModalOpen(false)
      },
    })
  }

  const allUsers = data?.users ?? []
  const filtered = roleFilter === 'ALL'
    ? allUsers
    : allUsers.filter((u) => u.unitAccess.some((ua) => ua.role === roleFilter))

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
            onChange={(e) => onSearchChange(e.target.value)}
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

        {data && (
          <span className="text-xs text-gx ml-auto">
            {filtered.length} de {data.total} usuários
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
        {isLoading ? (
          <div className="p-5">
            <SkeletonList count={5} />
          </div>
        ) : (
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
                <UserRow key={user.id} user={user} />
              ))}
            </tbody>
          </table>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center">
            <i className="ti ti-users-off text-3xl text-gx mb-2 block" aria-hidden="true" />
            <p className="text-sm text-gx">Nenhum usuário encontrado</p>
          </div>
        )}
      </div>

      {/* New user modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo usuário" size="md">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-gray-700 mb-1">
                Nome completo
              </label>
              <input
                id="name"
                type="text"
                placeholder="Nome do usuário"
                {...register('name')}
                className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd focus:ring-1 focus:ring-gd/20"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                placeholder="usuario@mediall.com.br"
                {...register('email')}
                className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd focus:ring-1 focus:ring-gd/20"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
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
              {...register('password')}
              className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd focus:ring-1 focus:ring-gd/20"
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label htmlFor="scope" className="block text-xs font-semibold text-gray-700 mb-1">
              Escopo de acesso
            </label>
            <select
              id="scope"
              {...register('accessScope')}
              className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd text-gray-700"
            >
              {Object.values(AccessScope).map((s) => (
                <option key={s} value={s}>{SCOPE_LABEL[s]}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gs/60">
            <Button variant="secondary" type="button" onClick={() => { reset(); setModalOpen(false) }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Criando...' : 'Criar usuário'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
