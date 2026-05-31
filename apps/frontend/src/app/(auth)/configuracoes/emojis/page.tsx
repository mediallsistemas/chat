'use client'

import { useState, useRef } from 'react'
import { Button, Input, EmptyState, ConfirmDialog } from '@/components/ui'
import {
  useCustomEmojis,
  useCreateCustomEmoji,
  useDeleteCustomEmoji,
} from '@/hooks/use-chat'
import { useAuthStore } from '@/store/auth-store'
import { UserRole, type CustomEmoji } from '@mediall/types'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR]

export default function EmojisPage() {
  const { user } = useAuthStore()
  const canManage = user ? ADMIN_ROLES.includes(user.role) : false

  const { data: emojis = [], isLoading } = useCustomEmojis()
  const { mutate: createEmoji, isPending: creating } = useCreateCustomEmoji()
  const { mutate: deleteEmoji, isPending: deleting } = useDeleteCustomEmoji()
  const [confirmDelete, setConfirmDelete] = useState<CustomEmoji | null>(null)

  const [shortcode, setShortcode] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!shortcode.trim() || !file) {
      setError('Preencha o shortcode e selecione um arquivo.')
      return
    }
    createEmoji(
      { shortcode: shortcode.trim().toLowerCase(), file },
      {
        onSuccess: () => {
          setShortcode('')
          setFile(null)
          if (fileInputRef.current) fileInputRef.current.value = ''
        },
        onError: (err) => {
          const apiErr = err as { response?: { data?: { message?: string } } }
          setError(apiErr.response?.data?.message ?? 'Erro ao criar emoji.')
        },
      },
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-gd flex items-center gap-2">
          <i className="ti ti-mood-smile text-2xl" aria-hidden="true" />
          Emojis customizados
        </h1>
        <p className="text-sm text-gx mt-1">
          Emojis usáveis em mensagens da unidade via{' '}
          <code className="bg-page-bg px-1 rounded">:shortcode:</code>.
        </p>
      </header>

      {canManage && (
        <form onSubmit={handleSubmit} className="bg-white border border-gs/60 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gd">Adicionar novo</h2>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gx mb-1">Shortcode</label>
              <Input
                value={shortcode}
                onChange={(e) => setShortcode(e.target.value)}
                placeholder="ex: parabens"
                pattern="[a-z0-9_-]{2,32}"
                maxLength={32}
                disabled={creating}
              />
            </div>
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs text-gx mb-1">Imagem (PNG, GIF ou WebP, máx 256 KB)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/gif,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={creating}
                className="text-xs"
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? 'Enviando…' : 'Adicionar'}
            </Button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-gx text-center py-12">Carregando…</p>
      ) : emojis.length === 0 ? (
        <EmptyState
          icon="ti-mood-smile"
          title="Nenhum emoji customizado"
          description={
            canManage
              ? 'Adicione o primeiro emoji acima.'
              : 'Peça pro gestor da unidade adicionar emojis.'
          }
        />
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {emojis.map((e) => (
            <li
              key={e.id}
              className="bg-white border border-gs/60 rounded-2xl p-3 flex items-center gap-3"
            >
              <img src={e.url} alt={e.shortcode} className="w-10 h-10 object-contain shrink-0" />
              <div className="flex-1 min-w-0">
                <code className="text-xs text-gd font-semibold block truncate">
                  :{e.shortcode}:
                </code>
                <span className="text-[10px] text-gx">
                  {new Date(e.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
              {canManage && (
                <button
                  onClick={() => setConfirmDelete(e)}
                  className="p-1 text-gx hover:text-red-500 transition-colors shrink-0"
                  aria-label="Remover"
                >
                  <i className="ti ti-trash text-sm" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) deleteEmoji(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) })
        }}
        title="Remover emoji"
        message={`Remover o emoji :${confirmDelete?.shortcode}:? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        loading={deleting}
      />
    </div>
  )
}
