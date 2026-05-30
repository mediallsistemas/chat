'use client'

import { useEffect, useRef, useState, KeyboardEvent } from 'react'
import { Avatar } from '@/components/ui'
import { useMeetingChat, useSendMeetingChat } from '@/hooks/use-meetings'
import { useAuthStore } from '@/store/auth-store'

interface Props {
  meetingId: string
  readOnly?: boolean
  onClose: () => void
}

export function MeetingChatPanel({ meetingId, readOnly = false, onClose }: Props) {
  const { user } = useAuthStore()
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useMeetingChat(meetingId)
  const { mutate: send, isPending: sending } = useSendMeetingChat(meetingId)
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const messages = data?.pages.flatMap((p) => p.messages) ?? []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function submit() {
    const content = text.trim()
    if (!content) return
    send(content, {
      onSuccess: () => setText(''),
    })
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <aside className="w-80 shrink-0 bg-white border-l border-gs/60 flex flex-col h-full">
      <header className="px-4 py-3 border-b border-gs/60 flex items-center gap-2">
        <i className="ti ti-message-circle text-lg text-gd" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-800">Chat da reunião</h2>
        {readOnly && (
          <span className="text-[10px] text-gx bg-page-bg px-1.5 py-0.5 rounded-full">somente leitura</span>
        )}
        <button
          onClick={onClose}
          className="ml-auto p-1 rounded-lg text-gx hover:bg-page-bg hover:text-gray-700"
          aria-label="Fechar chat"
        >
          <i className="ti ti-x text-base" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="text-xs text-gd hover:underline mx-auto block"
          >
            {isFetchingNextPage ? 'Carregando…' : 'Carregar anteriores'}
          </button>
        )}

        {isLoading && <p className="text-xs text-gx text-center py-4">Carregando…</p>}

        {!isLoading && messages.length === 0 && (
          <p className="text-xs text-gx text-center py-12 px-2">
            {readOnly
              ? 'Nenhuma mensagem foi trocada nesta reunião.'
              : 'Compartilhe links, perguntas e notas sem interromper a fala.'}
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-2">
            <Avatar name={m.sender.name} src={m.sender.avatarUrl} size="xs" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className={m.senderId === user?.id ? 'text-xs font-semibold text-gd' : 'text-xs font-semibold text-gray-800'}>
                  {m.sender.name}
                </span>
                <span className="text-[10px] text-gx">
                  {new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-0.5">
                {m.content}
              </p>
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {!readOnly && (
        <div className="px-4 py-3 bg-white border-t border-gs/60 shrink-0">
          <div className="flex items-end gap-2 bg-page-bg rounded-2xl px-3 py-2 border border-gs/60 focus-within:border-gd transition-colors">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Mensagem…"
              rows={1}
              className="flex-1 text-sm bg-transparent resize-none focus:outline-none max-h-24 leading-relaxed"
              style={{ minHeight: '24px' }}
            />
            <button
              onClick={submit}
              disabled={!text.trim() || sending}
              className="p-1.5 rounded-xl bg-gd text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
              aria-label="Enviar"
            >
              <i className="ti ti-send text-sm" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
