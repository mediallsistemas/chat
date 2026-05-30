'use client'

import { useState, useEffect, useRef, useCallback, KeyboardEvent, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { Avatar, Button, Modal } from '@/components/ui'
import {
  useGroups, useMessages, useSendMessage, useDeleteMessage,
  usePinMessage, useTypingIndicator, useCreateGroup, useStartDirect, usePresence,
  useUploadFile, useToggleReaction,
} from '@/hooks/use-chat'
import { useTaskSearch } from '@/hooks/use-task-files'
import { useAuthStore } from '@/store/auth-store'
import { useUnitStore } from '@/store/unit-store'
import { api } from '@/lib/api'
import { getSocket, connectSocket } from '@/lib/socket'
import { GroupType, type Group, type Message } from '@mediall/types'

// ─── Mention helpers ──────────────────────────────────────────────────────────

const MENTION_RE = /@\[([TO]):([a-f0-9-]+)\|([^\]]+)\]/g

function renderContent(content: string) {
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  MENTION_RE.lastIndex = 0
  while ((match = MENTION_RE.exec(content)) !== null) {
    if (match.index > last) parts.push(content.slice(last, match.index))
    const [, type, , title] = match
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gd/10 text-gd text-[11px] font-medium"
      >
        <i className={clsx('ti text-[10px]', type === 'T' ? 'ti-subtask' : 'ti-target')} aria-hidden="true" />
        {title}
      </span>,
    )
    last = match.index + match[0].length
  }
  if (last < content.length) parts.push(content.slice(last))
  return parts
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_TYPE_ICON: Record<GroupType, string> = {
  [GroupType.GENERAL]:   'ti-building',
  [GroupType.SECTOR]:    'ti-users-group',
  [GroupType.SUBSECTOR]: 'ti-users',
  [GroupType.PROJECT]:   'ti-target',
  [GroupType.TEMPORARY]: 'ti-clock',
  [GroupType.PRIVATE]:   'ti-lock',
}

const GROUP_TYPE_LABEL: Record<GroupType, string> = {
  [GroupType.GENERAL]:   'Geral',
  [GroupType.SECTOR]:    'Setor',
  [GroupType.SUBSECTOR]: 'Subsetor',
  [GroupType.PROJECT]:   'Projeto',
  [GroupType.TEMPORARY]: 'Temporário',
  [GroupType.PRIVATE]:   'Privado',
}

// ─── Message bubble ───────────────────────────────────────────────────────────

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏']

function MessageBubble({
  msg,
  isMine,
  currentUserId,
  onDelete,
  onPin,
  onReply,
  onReact,
}: {
  msg: Message
  isMine: boolean
  currentUserId: string
  onDelete: () => void
  onPin: () => void
  onReply: () => void
  onReact: (emoji: string) => void
}) {
  const [hover, setHover] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)

  // Group flat reaction list into summary { emoji → { count, isMine } }
  const reactionSummary = (msg.reactions ?? []).reduce<Record<string, { count: number; isMine: boolean }>>(
    (acc, r) => {
      acc[r.emoji] ??= { count: 0, isMine: false }
      acc[r.emoji].count++
      if (r.userId === currentUserId) acc[r.emoji].isMine = true
      return acc
    },
    {},
  )

  if (msg.isDeleted) {
    return (
      <div className={clsx('flex gap-2 mb-2', isMine && 'flex-row-reverse')}>
        <div className="w-7 h-7 shrink-0" />
        <span className="text-xs text-gx italic px-3 py-2">Mensagem excluída</span>
      </div>
    )
  }

  return (
    <div
      className={clsx('flex gap-2 mb-2 group', isMine && 'flex-row-reverse')}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {!isMine && (
        <div className="shrink-0 mt-auto">
          <Avatar name={msg.sender.name} src={msg.sender.avatarUrl} size="xs" />
        </div>
      )}

      <div className={clsx('flex flex-col max-w-[70%]', isMine && 'items-end')}>
        {!isMine && (
          <span className="text-[11px] font-semibold text-gd mb-0.5 px-1">{msg.sender.name}</span>
        )}

        {/* Reply preview */}
        {msg.replyTo && !msg.replyTo.id && null}
        {msg.replyTo && (
          <div className="text-[11px] text-gx bg-gs/40 rounded-t-lg px-2 py-1 border-l-2 border-gd mb-0.5 max-w-full truncate">
            <span className="font-semibold text-gd">{msg.replyTo.sender.name}</span>
            {' · '}{msg.replyTo.content}
          </div>
        )}

        <div
          className={clsx(
            'px-3 py-2 rounded-2xl text-sm leading-relaxed',
            isMine
              ? 'bg-gd text-white rounded-tr-sm'
              : 'bg-white border border-gs/60 text-gray-800 rounded-tl-sm',
          )}
        >
          {/* File/image attachment */}
          {msg.fileUrl && msg.type === 'IMAGE' && (
            <img
              src={msg.fileUrl}
              alt={msg.fileName ?? 'imagem'}
              className="rounded-xl max-w-xs max-h-60 mb-2 object-cover"
            />
          )}
          {msg.fileUrl && msg.type === 'FILE' && (
            <a
              href={msg.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                'flex items-center gap-2 mb-2 px-3 py-2 rounded-xl text-xs font-medium',
                isMine ? 'bg-white/20 text-white' : 'bg-page-bg text-gd',
              )}
            >
              <i className="ti ti-file text-base" aria-hidden="true" />
              <span className="truncate max-w-[200px]">{msg.fileName ?? 'arquivo'}</span>
              <i className="ti ti-download text-base ml-auto shrink-0" aria-hidden="true" />
            </a>
          )}
          {msg.content && <span>{renderContent(msg.content)}</span>}
          {msg.isPinned && (
            <i className="ti ti-pin text-[10px] ml-1.5 opacity-60" aria-hidden="true" />
          )}
        </div>

        <div className="flex items-center gap-1 mt-0.5 px-1">
          <span className="text-[10px] text-gx">
            {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {msg.isEdited && <span className="text-[10px] text-gx">(editado)</span>}
        </div>

        {/* Reaction bubbles */}
        {Object.keys(reactionSummary).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {Object.entries(reactionSummary).map(([emoji, { count, isMine: mine }]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={clsx(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
                  mine
                    ? 'bg-gd/10 border-gd/30 text-gd'
                    : 'bg-white border-gs/60 text-gray-600 hover:bg-page-bg',
                )}
                title={mine ? 'Remover reação' : 'Reagir'}
              >
                <span>{emoji}</span>
                <span className="font-medium">{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions */}
      <div
        className={clsx(
          'self-center flex items-center gap-1 transition-opacity relative',
          hover ? 'opacity-100' : 'opacity-0',
        )}
      >
        {/* Emoji picker */}
        <div className="relative">
          <button
            onClick={() => setEmojiOpen((o) => !o)}
            className="p-1 rounded-lg text-gx hover:bg-page-bg hover:text-gray-700 transition-colors"
            aria-label="Reagir"
            title="Reagir"
          >
            <i className="ti ti-mood-smile text-sm" aria-hidden="true" />
          </button>
          {emojiOpen && (
            <div
              className={clsx(
                'absolute bottom-8 z-20 bg-white rounded-2xl border border-gs/60 shadow-lg p-1.5 flex gap-1',
                isMine ? 'right-0' : 'left-0',
              )}
            >
              {QUICK_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => { onReact(e); setEmojiOpen(false) }}
                  className="text-lg hover:scale-125 transition-transform p-0.5 rounded-lg hover:bg-page-bg"
                  aria-label={`Reagir com ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onReply}
          className="p-1 rounded-lg text-gx hover:bg-page-bg hover:text-gray-700 transition-colors"
          aria-label="Responder"
          title="Responder"
        >
          <i className="ti ti-corner-up-left text-sm" aria-hidden="true" />
        </button>
        <button
          onClick={onPin}
          className="p-1 rounded-lg text-gx hover:bg-page-bg hover:text-gray-700 transition-colors"
          aria-label={msg.isPinned ? 'Desafixar' : 'Fixar'}
          title={msg.isPinned ? 'Desafixar' : 'Fixar'}
        >
          <i className={clsx('ti text-sm', msg.isPinned ? 'ti-pin-filled text-gd' : 'ti-pin')} aria-hidden="true" />
        </button>
        {isMine && (
          <button
            onClick={onDelete}
            className="p-1 rounded-lg text-gx hover:bg-red-50 hover:text-red-400 transition-colors"
            aria-label="Excluir"
            title="Excluir"
          >
            <i className="ti ti-trash text-sm" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Group list item ──────────────────────────────────────────────────────────

function GroupItem({
  group,
  active,
  onClick,
  onlineCount = 0,
}: {
  group: Group
  active: boolean
  onClick: () => void
  onlineCount?: number
}) {
  const displayName =
    group.type === GroupType.PRIVATE
      ? 'Conversa direta'
      : group.name

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
        active ? 'bg-gd/10 text-gd' : 'hover:bg-page-bg text-gray-700',
      )}
    >
      <div className="relative shrink-0">
        <div
          className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center',
            active ? 'bg-gd/20' : 'bg-page-bg',
          )}
        >
          <i
            className={clsx('ti text-lg', GROUP_TYPE_ICON[group.type], active ? 'text-gd' : 'text-gx')}
            aria-hidden="true"
          />
        </div>
        {onlineCount > 0 && (
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-medium truncate', active ? 'text-gd' : 'text-gray-800')}>
          {displayName}
        </p>
        <p className="text-[11px] text-gx">{GROUP_TYPE_LABEL[group.type]}</p>
      </div>
      {(group._count?.messages ?? 0) > 0 && (
        <span className="text-[11px] text-gx shrink-0">{group._count!.messages}</span>
      )}
    </button>
  )
}

// ─── Start direct modal ───────────────────────────────────────────────────────

interface UnitMember { id: string; name: string; email: string; avatarUrl: string | null }

function StartDirectModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (userId: string) => void
}) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const [members, setMembers] = useState<UnitMember[]>([])
  const [search, setSearch] = useState('')
  const currentUser = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!open || !activeUnit) return
    api.get<{ data: UnitMember[] }>(`/units/${activeUnit.id}/members`).then((r) => {
      setMembers(r.data.data.filter((m) => m.id !== currentUser?.id))
    })
  }, [open, activeUnit, currentUser?.id])

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <Modal open={open} onClose={onClose} title="Nova conversa direta" size="sm">
      <div className="space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd"
          placeholder="Buscar por nome ou e-mail..."
          autoFocus
        />
        <div className="max-h-60 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-gx text-center py-4">Nenhum usuário encontrado</p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                onClick={() => { onSelect(m.id); onClose() }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-page-bg transition-colors text-left"
              >
                <Avatar name={m.name} src={m.avatarUrl} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                  <p className="text-[11px] text-gx truncate">{m.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Create group modal ───────────────────────────────────────────────────────

function CreateGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mutate: create, isPending } = useCreateGroup()
  const [name, setName] = useState('')
  const [type, setType] = useState<GroupType>(GroupType.SECTOR)
  const [description, setDescription] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    create(
      { name, type, description: description || undefined },
      { onSuccess: () => { onClose(); setName(''); setDescription('') } },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo grupo" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do grupo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd"
            placeholder="Ex: Equipe de Enfermagem"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as GroupType)}
            className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd text-gray-700"
          >
            {Object.values(GroupType).filter((t) => t !== GroupType.PRIVATE).map((t) => (
              <option key={t} value={t}>{GROUP_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd resize-none"
            placeholder="Para que serve este grupo?"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gs/60">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!name.trim() || isPending}>
            {isPending ? 'Criando...' : 'Criar grupo'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function MensagensPageInner() {
  const user = useAuthStore((s) => s.user)
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const searchParams = useSearchParams()
  const { data: groups = [], isLoading: loadingGroups } = useGroups()
  const { data: onlineIds = [] } = usePresence()
  const { mutate: startDirect } = useStartDirect()
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [dmOpen, setDmOpen] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null

  // Auto-select group from ?group= URL param
  useEffect(() => {
    const groupParam = searchParams.get('group')
    if (groupParam && groups.length > 0) {
      const found = groups.find((g) => g.id === groupParam)
      if (found) setActiveGroupId(groupParam)
    }
  }, [searchParams, groups])

  // Auto-select first group (only if no URL param)
  useEffect(() => {
    if (!activeGroupId && groups.length > 0 && !searchParams.get('group')) {
      setActiveGroupId(groups[0].id)
    }
  }, [groups, activeGroupId, searchParams])

  const { data: mentionSuggestions = [] } = useTaskSearch(
    activeUnit?.id ?? '',
    mentionQuery,
  )

  function handleStartDirect(targetUserId: string) {
    startDirect(targetUserId, {
      onSuccess: (res) => {
        const group = (res.data as unknown as { data: Group }).data
        setActiveGroupId(group.id)
      },
    })
  }

  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(activeGroupId)

  const { mutate: sendMsg } = useSendMessage(activeGroupId ?? '')
  const { mutate: deleteMsg } = useDeleteMessage(activeGroupId ?? '')
  const { mutate: pinMsg } = usePinMessage(activeGroupId ?? '')
  const { mutate: toggleReaction } = useToggleReaction(activeGroupId ?? '')
  const { onInputChange } = useTypingIndicator(activeGroupId)
  const { mutateAsync: uploadFile, isPending: uploading } = useUploadFile()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Flatten infinite pages into a single message array
  const messages = messagesData?.pages.flatMap((p) => p.messages) ?? []


  // Connect socket on mount
  useEffect(() => { connectSocket() }, [])

  // Listen for typing indicators
  useEffect(() => {
    const socket = getSocket()
    function onTyping({ userId, isTyping }: { userId: string; groupId: string; isTyping: boolean }) {
      setTypingUsers((prev) => {
        const next = new Set(prev)
        isTyping ? next.add(userId) : next.delete(userId)
        return next
      })
    }
    socket.on('user:typing', onTyping)
    return () => { socket.off('user:typing', onTyping) }
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function send() {
    const content = text.trim()
    if (!content) return
    sendMsg({ content, replyToId: replyTo?.id })
    setText('')
    setReplyTo(null)
    setMentionQuery('')
    setMentionStart(-1)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const uploaded = await uploadFile(file)
    sendMsg({
      content: '',
      fileKey: uploaded.key,
      fileName: uploaded.fileName,
      fileSize: uploaded.size,
      fileMime: uploaded.mimeType,
    })
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') { setMentionQuery(''); setMentionStart(-1); return }
    if (e.key === 'Enter' && !e.shiftKey && mentionSuggestions.length === 0) {
      e.preventDefault(); send()
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setText(value)
    onInputChange()

    // Detect @word at cursor
    const cursor = e.target.selectionStart ?? value.length
    const before = value.slice(0, cursor)
    const atMatch = /@(\w*)$/.exec(before)
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setMentionStart(atMatch.index)
    } else {
      setMentionQuery('')
      setMentionStart(-1)
    }
  }

  function insertMention(id: string, title: string) {
    const token = `@[T:${id}|${title}]`
    const before = text.slice(0, mentionStart)
    const after = text.slice(mentionStart + 1 + mentionQuery.length)
    setText(before + token + ' ' + after)
    setMentionQuery('')
    setMentionStart(-1)
    textareaRef.current?.focus()
  }

  return (
    <div className="-m-6 h-[calc(100vh-56px)] flex overflow-hidden">
      {/* Group sidebar */}
      <aside className="w-64 shrink-0 border-r border-gs/60 bg-white flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gs/60">
          <h2 className="text-sm font-semibold text-gray-800 font-sora">Mensagens</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDmOpen(true)}
              className="p-1.5 rounded-lg text-gx hover:bg-page-bg hover:text-gd transition-colors"
              aria-label="Nova conversa direta"
              title="Nova conversa direta"
            >
              <i className="ti ti-user-plus text-base" aria-hidden="true" />
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="p-1.5 rounded-lg text-gx hover:bg-page-bg hover:text-gd transition-colors"
              aria-label="Novo grupo"
              title="Novo grupo"
            >
              <i className="ti ti-plus text-base" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loadingGroups ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-gs/30 animate-pulse mx-1 mb-1" />
            ))
          ) : groups.length === 0 ? (
            <div className="py-10 text-center">
              <i className="ti ti-message-off text-3xl text-gx mb-2 block" aria-hidden="true" />
              <p className="text-xs text-gx">Nenhum grupo</p>
            </div>
          ) : (
            groups.map((g) => {
              const memberIds = g.members?.map((m) => m.userId) ?? []
              const onlineCount = memberIds.filter((id) => onlineIds.includes(id) && id !== user?.id).length
              return (
                <GroupItem
                  key={g.id}
                  group={g}
                  active={g.id === activeGroupId}
                  onClick={() => setActiveGroupId(g.id)}
                  onlineCount={onlineCount}
                />
              )
            })
          )}
        </div>
      </aside>

      {/* Chat panel */}
      {activeGroup ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="h-14 bg-white border-b border-gs/60 px-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <i
                className={clsx('ti text-xl text-gd', GROUP_TYPE_ICON[activeGroup.type])}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-semibold text-gray-800">{activeGroup.name}</p>
                <p className="text-[11px] text-gx">
                  {activeGroup._count?.members ?? 0} membros · {GROUP_TYPE_LABEL[activeGroup.type]}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="p-2 rounded-lg text-gx hover:bg-page-bg hover:text-gd transition-colors"
                aria-label="Pesquisar mensagens"
                title="Pesquisar"
              >
                <i className="ti ti-search text-base" aria-hidden="true" />
              </button>
              <button
                className="p-2 rounded-lg text-gx hover:bg-page-bg hover:text-gd transition-colors"
                aria-label="Membros"
                title="Membros"
              >
                <i className="ti ti-users text-base" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 bg-page-bg/30">
            {/* Load more */}
            {hasNextPage && (
              <div className="text-center mb-4">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="text-xs text-gd hover:underline"
                >
                  {isFetchingNextPage ? 'Carregando...' : 'Carregar mensagens anteriores'}
                </button>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <i className="ti ti-message-2 text-4xl text-gx" aria-hidden="true" />
                <p className="text-sm text-gx">Nenhuma mensagem ainda. Seja o primeiro!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isMine={msg.senderId === user?.id}
                  currentUserId={user?.id ?? ''}
                  onDelete={() => deleteMsg(msg.id)}
                  onPin={() => pinMsg(msg.id)}
                  onReply={() => setReplyTo(msg)}
                  onReact={(emoji) => toggleReaction({ messageId: msg.id, emoji })}
                />
              ))
            )}

            <div ref={bottomRef} />
          </div>

          {/* Typing indicator */}
          {typingUsers.size > 0 && (
            <div className="px-5 py-1 text-xs text-gx bg-white border-t border-gs/40">
              <span className="flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full bg-gx animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </span>
                Alguém está digitando...
              </span>
            </div>
          )}

          {/* Reply preview */}
          {replyTo && (
            <div className="px-5 py-2 bg-white border-t border-gs/40 flex items-center gap-3">
              <div className="flex-1 min-w-0 border-l-2 border-gd pl-2">
                <p className="text-[11px] font-semibold text-gd">{replyTo.sender.name}</p>
                <p className="text-xs text-gx truncate">{replyTo.content}</p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="p-1 text-gx hover:text-gray-700"
                aria-label="Cancelar resposta"
              >
                <i className="ti ti-x text-sm" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Mention autocomplete */}
          {mentionQuery !== '' && mentionSuggestions.length > 0 && (
            <div className="px-4 bg-white border-t border-gs/60">
              <div className="rounded-xl border border-gs shadow-sm overflow-hidden">
                {mentionSuggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertMention(s.id, s.title) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gd/5 transition-colors text-left"
                  >
                    <i className="ti ti-subtask text-gx text-xs shrink-0" aria-hidden="true" />
                    <span className="truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input bar */}
          <div className="px-4 py-3 bg-white border-t border-gs/60 shrink-0">
            <div className="flex items-end gap-2 bg-page-bg rounded-2xl px-3 py-2 border border-gs/60 focus-within:border-gd transition-colors">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-1 rounded-lg text-gx hover:text-gd disabled:opacity-40 transition-colors shrink-0"
                aria-label="Anexar arquivo"
                title="Anexar arquivo"
              >
                {uploading
                  ? <i className="ti ti-loader-2 text-base animate-spin" aria-hidden="true" />
                  : <i className="ti ti-paperclip text-base" aria-hidden="true" />
                }
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              />
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={onKeyDown}
                placeholder="Mensagem... (@ para mencionar tarefa)"
                rows={1}
                className="flex-1 text-sm bg-transparent resize-none focus:outline-none max-h-32 leading-relaxed"
                style={{ minHeight: '24px' }}
              />
              <button
                onClick={send}
                disabled={!text.trim()}
                className="p-1.5 rounded-xl bg-gd text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
                aria-label="Enviar mensagem"
              >
                <i className="ti ti-send text-sm" aria-hidden="true" />
              </button>
            </div>
            <p className="text-[10px] text-gx mt-1 pl-1">Enter para enviar · Shift+Enter para nova linha</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <i className="ti ti-message-2 text-5xl text-gx" aria-hidden="true" />
          <p className="text-sm text-gray-600 font-medium">Selecione um grupo para conversar</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="text-sm text-gd hover:underline"
          >
            ou crie um novo grupo
          </button>
        </div>
      )}

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <StartDirectModal
        open={dmOpen}
        onClose={() => setDmOpen(false)}
        onSelect={handleStartDirect}
      />
    </div>
  )
}

export default function MensagensPage() {
  return (
    <Suspense>
      <MensagensPageInner />
    </Suspense>
  )
}
