'use client'

import { useRouter } from 'next/navigation'
import { Avatar, Button } from '@/components/ui'
import { useBookmarks, useToggleBookmark } from '@/hooks/use-chat'
import { GroupType } from '@mediall/types'

const GROUP_TYPE_ICON: Record<GroupType, string> = {
  [GroupType.GENERAL]:   'ti-building',
  [GroupType.SECTOR]:    'ti-users-group',
  [GroupType.SUBSECTOR]: 'ti-users',
  [GroupType.PROJECT]:   'ti-target',
  [GroupType.TEMPORARY]: 'ti-clock',
  [GroupType.PRIVATE]:   'ti-lock',
}

export default function SalvosPage() {
  const router = useRouter()
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useBookmarks()
  const { mutate: toggleBookmark } = useToggleBookmark()

  const bookmarks = data?.pages.flatMap((p) => p.bookmarks) ?? []

  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/mensagens')}
            className="p-1.5 rounded-lg hover:bg-page-bg transition-colors"
            aria-label="Voltar"
          >
            <i className="ti ti-arrow-left text-xl text-gd" aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gd flex items-center gap-2">
              <i className="ti ti-bookmark text-2xl" aria-hidden="true" />
              Mensagens salvas
            </h1>
            <p className="text-sm text-gx">
              {bookmarks.length === 0 ? 'Nenhuma mensagem salva' : `${bookmarks.length} mensagens`}
            </p>
          </div>
        </div>
      </header>

      {isLoading && (
        <div className="text-center py-12 text-sm text-gx">Carregando…</div>
      )}

      {!isLoading && bookmarks.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
          <i className="ti ti-bookmark-off text-5xl text-gs opacity-30" aria-hidden="true" />
          <div>
            <p className="text-base font-semibold text-gd">Nada salvo ainda</p>
            <p className="text-sm text-gx mt-1">
              Clique no ícone de marcador em qualquer mensagem pra salvá-la aqui.
            </p>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {bookmarks.map((b) => (
          <li
            key={b.id}
            className="bg-white border border-gs/60 rounded-2xl p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-2 text-xs text-gx mb-2">
              <i
                className={`ti ${GROUP_TYPE_ICON[b.message.group.type]} text-sm`}
                aria-hidden="true"
              />
              <span className="font-medium text-gd">{b.message.group.name}</span>
              <span>·</span>
              <span>
                Salvo em{' '}
                {new Date(b.createdAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <Avatar
                name={b.message.sender.name}
                src={b.message.sender.avatarUrl}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm font-semibold text-gd">
                    {b.message.sender.name}
                  </span>
                  <span className="text-[11px] text-gx">
                    {new Date(b.message.createdAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                  {b.message.content || (
                    <em className="text-gx">
                      {b.message.fileName ? `📎 ${b.message.fileName}` : '(sem texto)'}
                    </em>
                  )}
                </p>
              </div>

              <button
                onClick={() => toggleBookmark({ messageId: b.messageId, isBookmarked: true })}
                className="p-1.5 rounded-lg text-gd hover:bg-page-bg transition-colors shrink-0"
                aria-label="Remover dos salvos"
                title="Remover dos salvos"
              >
                <i className="ti ti-bookmark-filled text-base" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  router.push(`/mensagens?groupId=${b.message.groupId}&messageId=${b.messageId}`)
                }
              >
                <i className="ti ti-external-link mr-1" aria-hidden="true" />
                Ir para a conversa
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {hasNextPage && (
        <div className="flex justify-center mt-6">
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
  )
}
