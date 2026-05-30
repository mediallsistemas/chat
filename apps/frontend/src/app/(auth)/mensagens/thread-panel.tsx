'use client'

import { useState, KeyboardEvent, useEffect, useRef } from 'react'
import { Avatar } from '@/components/ui'
import { useThread, useSendMessage } from '@/hooks/use-chat'
import type { Message } from '@mediall/types'

interface Props {
  groupId: string
  parentId: string
  currentUserId: string
  onClose: () => void
}

export function ThreadPanel({ groupId, parentId, currentUserId, onClose }: Props) {
  const { data, isLoading } = useThread(groupId, parentId)
  const { mutate: sendMsg } = useSendMessage(groupId)
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data?.replies.length])

  function send() {
    const content = text.trim()
    if (!content) return
    sendMsg({ content, replyToId: parentId })
    setText('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <aside className="w-96 shrink-0 border-l border-gs/60 bg-white flex flex-col h-full">
      <header className="px-4 py-3 border-b border-gs/60 flex items-center gap-2">
        <i className="ti ti-message-circle-2 text-lg text-gd" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-800">Conversa</h2>
        <span className="text-[11px] text-gx">
          {data?.replies.length ?? 0} respostas
        </span>
        <button
          onClick={onClose}
          className="ml-auto p-1 rounded-lg text-gx hover:bg-page-bg hover:text-gray-700"
          aria-label="Fechar conversa"
        >
          <i className="ti ti-x text-base" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && <p className="text-xs text-gx text-center py-6">Carregando…</p>}

        {data?.parent && <ThreadMessageRow msg={data.parent} isParent isMine={data.parent.senderId === currentUserId} />}

        {data?.parent && data.replies.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-gx">
            <span className="flex-1 border-t border-gs/60" />
            <span>{data.replies.length} {data.replies.length === 1 ? 'resposta' : 'respostas'}</span>
            <span className="flex-1 border-t border-gs/60" />
          </div>
        )}

        {data?.replies.map((r) => (
          <ThreadMessageRow key={r.id} msg={r} isParent={false} isMine={r.senderId === currentUserId} />
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 bg-white border-t border-gs/60 shrink-0">
        <div className="flex items-end gap-2 bg-page-bg rounded-2xl px-3 py-2 border border-gs/60 focus-within:border-gd transition-colors">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Responder na conversa…"
            rows={1}
            className="flex-1 text-sm bg-transparent resize-none focus:outline-none max-h-32 leading-relaxed"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            className="p-1.5 rounded-xl bg-gd text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
            aria-label="Enviar resposta"
          >
            <i className="ti ti-send text-sm" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function ThreadMessageRow({
  msg,
  isParent,
  isMine,
}: {
  msg: Message
  isParent: boolean
  isMine: boolean
}) {
  return (
    <div className={isParent ? 'pb-2 border-b border-gs/40' : ''}>
      <div className="flex items-start gap-2">
        <Avatar name={msg.sender.name} src={msg.sender.avatarUrl} size="xs" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={isMine ? 'text-xs font-semibold text-gd' : 'text-xs font-semibold text-gray-800'}>
              {msg.sender.name}
            </span>
            <span className="text-[10px] text-gx">
              {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {msg.isEdited && <span className="text-[10px] text-gx">(editado)</span>}
          </div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-0.5">
            {msg.content}
          </p>
          {msg.fileUrl && msg.type === 'IMAGE' && (
            <img
              src={msg.fileUrl}
              alt={msg.fileName ?? ''}
              className="rounded-lg max-w-full max-h-48 mt-2 object-cover"
            />
          )}
          {msg.fileUrl && msg.type === 'FILE' && (
            <a
              href={msg.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-gd hover:underline"
            >
              <i className="ti ti-file text-sm" aria-hidden="true" />
              {msg.fileName ?? 'arquivo'}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
