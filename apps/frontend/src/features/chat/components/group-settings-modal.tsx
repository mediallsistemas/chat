'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { Modal, Button, Input, Textarea, Avatar } from '@/shared/components/ui'
import {
  useUpdateGroup,
  useUploadFile,
  useGroups,
  useGroupMembers,
  useUpdateMemberRole,
  useRemoveMember,
} from '@/features/chat/hooks/use-chat'
import { GroupMemberRole, GroupType, GroupVisibility, type Group } from '@mediall/types'

const schema = z.object({
  name: z.string().min(1, 'O nome é obrigatório.').max(80, 'No máximo 80 caracteres.'),
  description: z.string().max(500, 'No máximo 500 caracteres.').optional(),
})
type FormValues = z.infer<typeof schema>

type Tab = 'geral' | 'permissoes' | 'membros'

const ROLE_LABEL: Record<GroupMemberRole, string> = {
  [GroupMemberRole.ADMIN]: 'Administrador',
  [GroupMemberRole.MEMBER]: 'Membro',
  [GroupMemberRole.VIEWER]: 'Somente leitura',
}

export function GroupSettingsModal({
  open,
  onClose,
  group,
  currentUserId,
}: {
  open: boolean
  onClose: () => void
  group: Group
  currentUserId?: string
}) {
  const [tab, setTab] = useState<Tab>('geral')

  const { mutate: updateGroup, isPending: saving } = useUpdateGroup(group.id)
  const { mutateAsync: uploadFile, isPending: uploadingCover } = useUploadFile()
  const { data: groups = [] } = useGroups()

  // Pending cover: uploaded key (not yet saved) + a local preview URL.
  const [coverKey, setCoverKey] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)

  // Parent sector (organizational tree — plano 22 §4). Only meaningful for
  // SUBSECTOR groups; candidate parents are SECTOR groups other than this one.
  const [parentId, setParentId] = useState(group.parentId ?? '')
  const sectors = groups.filter((g) => g.type === GroupType.SECTOR && g.id !== group.id)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: group.name, description: group.description ?? '' },
  })

  async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const uploaded = await uploadFile(file)
    setCoverKey(uploaded.key)
    setCoverPreview(uploaded.url)
  }

  function saveGeneral(values: FormValues) {
    updateGroup(
      {
        name: values.name,
        description: values.description,
        ...(coverKey ? { avatarKey: coverKey } : {}),
        // Persist the parent only for subsectors; '' clears it on the backend.
        ...(group.type === GroupType.SUBSECTOR ? { parentId: parentId || null } : {}),
      },
      { onSuccess: onClose },
    )
  }

  function setPermission(patch: { onlyAdminsPost?: boolean; visibility?: GroupVisibility }) {
    updateGroup(patch)
  }

  return (
    <Modal open={open} onClose={onClose} title="Configurações do grupo" size="lg">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gs/60">
        {(['geral', 'permissoes', 'membros'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={clsx(
              'px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors',
              tab === t ? 'border-gd text-gd' : 'border-transparent text-gx hover:text-gray-700',
            )}
          >
            {t === 'geral' ? 'Geral' : t === 'permissoes' ? 'Permissões' : 'Membros'}
          </button>
        ))}
      </div>

      {tab === 'geral' && (
        <form onSubmit={form.handleSubmit(saveGeneral)} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-page-bg overflow-hidden flex items-center justify-center shrink-0">
              {coverPreview || group.avatarUrl ? (
                <img
                  src={coverPreview ?? group.avatarUrl ?? ''}
                  alt="Capa do grupo"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <i className="ti ti-photo text-2xl text-gx" aria-hidden="true" />
              )}
            </div>
            <label className="cursor-pointer">
              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-gs',
                  'text-gd hover:bg-page-bg transition-colors',
                  uploadingCover && 'opacity-60 pointer-events-none',
                )}
              >
                <i
                  className={clsx('ti', uploadingCover ? 'ti-loader-2 animate-spin' : 'ti-upload')}
                  aria-hidden="true"
                />
                Trocar capa
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={onPickCover} />
            </label>
          </div>

          <Input label="Nome" error={form.formState.errors.name?.message} {...form.register('name')} />
          <Textarea
            label="Descrição"
            error={form.formState.errors.description?.message}
            {...form.register('description')}
          />

          {group.type === GroupType.SUBSECTOR && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Setor pai</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gs rounded-lg focus:outline-none focus:border-gd text-gray-700"
              >
                <option value="">Sem setor pai</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-gx mt-1">
                Organiza o subsetor sob um setor na barra lateral. Não altera quem tem acesso.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gs/40">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Salvar
            </Button>
          </div>
        </form>
      )}

      {tab === 'permissoes' && (
        <div className="flex flex-col gap-3">
          <ToggleRow
            label="Somente administradores podem postar"
            hint="Membros comuns ficam apenas com leitura."
            checked={group.onlyAdminsPost}
            disabled={saving}
            onChange={(v) => setPermission({ onlyAdminsPost: v })}
          />
          <ToggleRow
            label="Grupo público na unidade"
            hint="Qualquer pessoa da unidade pode descobrir e entrar."
            checked={group.visibility === GroupVisibility.UNIT_PUBLIC}
            disabled={saving}
            onChange={(v) =>
              setPermission({
                visibility: v ? GroupVisibility.UNIT_PUBLIC : GroupVisibility.PRIVATE_INVITE,
              })
            }
          />
        </div>
      )}

      {tab === 'membros' && (
        <MembersTab groupId={group.id} currentUserId={currentUserId} />
      )}
    </Modal>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-4 p-3 rounded-xl border border-gs/60 hover:bg-page-bg text-left transition-colors disabled:opacity-60"
    >
      <span>
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        <span className="block text-[11px] text-gx mt-0.5">{hint}</span>
      </span>
      <span
        className={clsx(
          'w-10 h-6 rounded-full p-0.5 shrink-0 transition-colors',
          checked ? 'bg-gd' : 'bg-gs',
        )}
        aria-hidden="true"
      >
        <span
          className={clsx(
            'block w-5 h-5 rounded-full bg-white transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </span>
    </button>
  )
}

function MembersTab({
  groupId,
  currentUserId,
}: {
  groupId: string
  currentUserId?: string
}) {
  const { data: members = [], isLoading } = useGroupMembers(groupId)
  const { mutate: updateRole } = useUpdateMemberRole(groupId)
  const { mutate: removeMember } = useRemoveMember(groupId)

  if (isLoading) return <p className="text-sm text-gx text-center py-6">Carregando membros…</p>

  return (
    <ul className="flex flex-col divide-y divide-gs/40">
      {members.map((m) => (
        <li key={m.userId} className="flex items-center gap-3 py-2.5">
          <Avatar name={m.name} src={m.avatarUrl} size="sm" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-gray-800 truncate">
              {m.name}
              {m.userId === currentUserId && <span className="text-gx font-normal"> (você)</span>}
            </span>
          </span>
          <select
            value={m.role}
            onChange={(e) => updateRole({ userId: m.userId, role: e.target.value as GroupMemberRole })}
            className="text-xs rounded-lg border border-gs px-2 py-1 cursor-pointer text-gray-700 focus:outline-none focus:border-gd"
          >
            {Object.values(GroupMemberRole).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          {m.userId !== currentUserId && (
            <button
              type="button"
              onClick={() => removeMember(m.userId)}
              className="p-1 rounded-lg text-gx hover:bg-red-50 hover:text-red-400 transition-colors"
              aria-label={`Remover ${m.name}`}
              title="Remover do grupo"
            >
              <i className="ti ti-user-minus text-sm" aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
