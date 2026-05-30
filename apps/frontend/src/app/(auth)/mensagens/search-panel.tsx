'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Avatar, Button } from '@/components/ui'
import { useChatSearch } from '@/hooks/use-chat'
import type { ChatSearchResult } from '@mediall/types'

// Allow only `<mark>` / `</mark>` from ts_headline output; escape all
// other HTML to keep this safe under dangerouslySetInnerHTML.
function sanitizeHeadline(html: string): string {
  const escaped = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/&lt;mark&gt;/g, '<mark>')
    .replace(/&lt;\/mark&gt;/g, '</mark>')
}

interface Props {
  onClose: () => void
  onJumpToMessage: (result: ChatSearchResult) => void
  currentGroupId: string | null
}

const RANGE_OPTIONS: Array<{ label: string; days: number | null }> = [
  { label: 'Sempre',       days: null },
  { label: 'Últimos 7d',   days: 7 },
  { label: 'Últimos 30d',  days: 30 },
]

export function SearchPanel({ onClose, onJumpToMessage, currentGroupId }: Props) {
  const [q, setQ] = useState('')
  const [scope, setScope] = useState<'all' | 'current'>('all')
  const [rangeDays, setRangeDays] = useState<number | null>(null)
  const [debouncedQ, setDebouncedQ] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(t)
  }, [q])

  const from = rangeDays
    ? new Date(Date.now() - rangeDays * 24 * 60 * 60_000).toISOString()
    : undefined

  const groupId = scope === 'current' && currentGroupId ? currentGroupId : undefined

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useChatSearch(
    { q: debouncedQ, groupId, from },
    debouncedQ.trim().length >= 2,
  )

  const results = data?.pages.flatMap((p) => p.results) ?? []

  return (
    <aside className="w-96 shrink-0 border-l border-gs/60 bg-white flex flex-col h-full">
      <header className="px-4 py-3 border-b border-gs/60 flex items-center gap-2">
        <i className="ti ti-search text-lg text-gd" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-800">Buscar mensagens</h2>
        <button
          onClick={onClose}
          className="ml-auto p-1 rounded-lg text-gx hover:bg-page-bg hover:text-gray-700"
          aria-label="Fechar busca"
        >
          <i className="ti ti-x text-base" aria-hidden="true" />
        </button>
      </header>

      <div className="px-4 py-3 space-y-2 border-b border-gs/60">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Digite ao menos 2 caracteres…"
          className="w-full text-sm border border-gs rounded-xl px-3 py-2 focus:outline-none focus:border-gd"
        />
        <div className="flex gap-1 text-xs">
          {currentGroupId && (
            <button
              onClick={() => setScope(scope === 'current' ? 'all' : 'current')}
              className={clsx(
                'px-2 py-1 rounded-lg border',
                scope === 'current'
                  ? 'border-gd bg-gd/10 text-gd font-medium'
                  : 'border-gs text-gx hover:bg-page-bg',
              )}
            >
              Neste grupo
            </button>
          )}
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.label}
              onClick={() => setRangeDays(r.days)}
              className={clsx(
                'px-2 py-1 rounded-lg border',
                rangeDays === r.days
                  ? 'border-gd bg-gd/10 text-gd font-medium'
                  : 'border-gs text-gx hover:bg-page-bg',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {debouncedQ.trim().length < 2 && (
          <p className="text-xs text-gx text-center py-12 px-4">
            Pesquise por palavras-chave em qualquer mensagem dos seus grupos.
          </p>
        )}

        {isLoading && (
          <p className="text-xs text-gx text-center py-6">Buscando…</p>
        )}

        {!isLoading && debouncedQ.trim().length >= 2 && results.length === 0 && (
          <p className="text-xs text-gx text-center py-12 px-4">
            Nenhum resultado para “{debouncedQ}”.
          </p>
        )}

        <ul className="divide-y divide-gs/40">
          {results.map((r) => (
            <li
              key={r.id}
              onClick={() => onJumpToMessage(r)}
              className="px-4 py-3 hover:bg-page-bg cursor-pointer"
            >
              <div className="flex items-center gap-2 text-[11px] text-gx mb-1">
                <i className="ti ti-message-2 shrink-0" aria-hidden="true" />
                <span className="font-medium text-gd truncate">{r.groupName}</span>
                <span>·</span>
                <span className="shrink-0">
                  {new Date(r.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Avatar name={r.senderName} src={r.senderAvatarUrl} size="xs" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800">{r.senderName}</p>
                  <p
                    className="text-xs text-gray-700 mt-0.5 line-clamp-2 [&_mark]:bg-yellow-200 [&_mark]:rounded [&_mark]:px-0.5"
                    dangerouslySetInnerHTML={{ __html: sanitizeHeadline(r.headline) }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        {hasNextPage && (
          <div className="p-3 flex justify-center">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
