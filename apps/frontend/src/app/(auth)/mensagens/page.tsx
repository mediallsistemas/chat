'use client'

import { useState, useEffect, useRef, useCallback, useMemo, memo, KeyboardEvent, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { Avatar, Button, Modal, ProgressBar } from '@/shared/components/ui'
import {
  useGroups, useMessages, useSendMessage, useDeleteMessage,
  usePinMessage, useTypingIndicator, useCreateGroup, useStartDirect, usePresence,
  useToggleReaction, useBookmarks, useToggleBookmark,
  useCustomEmojis, useCreateReminder,
  useDiscoverableGroups, useJoinGroup,
  useActiveHuddle, useStartHuddle, useJoinHuddle,
  useGroupSystemEvents, useMarkGroupRead,
} from '@/features/chat/hooks/use-chat'
import { useFileAttachment } from '@/features/chat/hooks/use-file-attachment'
import { GroupSettingsModal } from '@/features/chat/components'
import { useElapsed } from '@/shared/hooks/use-elapsed'
import type { HuddleTokenResponse } from '@mediall/types'
import { parseSlash, SLASH_COMMANDS } from '@/shared/lib/slash-commands'
import { SearchPanel } from './search-panel'
import { ThreadPanel } from './thread-panel'
import dynamic from 'next/dynamic'

// Load LiveKit-bundle component lazily; SSR-safe.
const HuddleMini = dynamic(() => import('./huddle-mini').then((m) => m.HuddleMini), { ssr: false })
import { useTaskSearch } from '@/features/kanban/hooks/use-task-files'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { useUnitStore } from '@/shared/store/unit-store'
import { api } from '@/shared/lib/api'
import { getSocket, connectSocket } from '@/shared/lib/socket'
import { toast } from '@/shared/hooks/use-toast'
import { getErrorMessage } from '@/shared/lib/get-error-message'
import { GroupType, GroupVisibility, UserRole, type Group, type Message } from '@mediall/types'

// ─── Mention + custom emoji helpers ───────────────────────────────────────────

const MENTION_RE     = /@\[([TO]):([a-f0-9-]+)\|([^\]]+)\]/g
const CUSTOM_EMOJI_RE = /:([a-z0-9_-]{2,32}):/g

function renderContent(content: string, customEmojis?: Map<string, string>) {
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  MENTION_RE.lastIndex = 0
  while ((match = MENTION_RE.exec(content)) !== null) {
    if (match.index > last) parts.push(renderInline(content.slice(last, match.index), customEmojis, `t-${match.index}`))
    const [, type, , title] = match
    parts.push(
      <span
        key={`m-${match.index}`}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gd/10 text-gd text-[11px] font-medium"
      >
        <i className={clsx('ti text-[10px]', type === 'T' ? 'ti-subtask' : 'ti-target')} aria-hidden="true" />
        {title}
      </span>,
    )
    last = match.index + match[0].length
  }
  if (last < content.length) parts.push(renderInline(content.slice(last), customEmojis, `t-tail`))
  return parts
}

function renderInline(text: string, customEmojis: Map<string, string> | undefined, keyPrefix: string) {
  if (!customEmojis || customEmojis.size === 0) return text
  const out: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  CUSTOM_EMOJI_RE.lastIndex = 0
  while ((m = CUSTOM_EMOJI_RE.exec(text)) !== null) {
    const url = customEmojis.get(m[1])
    if (!url) continue
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <img
        key={`${keyPrefix}-e-${m.index}`}
        src={url}
        alt={`:${m[1]}:`}
        title={`:${m[1]}:`}
        className="inline-block align-text-bottom h-5 w-5 mx-0.5"
      />,
    )
    last = m.index + m[0].length
  }
  if (last === 0) return text
  if (last < text.length) out.push(text.slice(last))
  return out
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_TYPE_ICON: Record<GroupType, string> = {
  [GroupType.GENERAL]:   'ti-building',
  [GroupType.SECTOR]:    'ti-users-group',
  [GroupType.SUBSECTOR]: 'ti-users',
  [GroupType.PROJECT]:   'ti-target',
  [GroupType.TEMPORARY]: 'ti-clock',
  [GroupType.PRIVATE]:   'ti-message-circle',
}

const GROUP_TYPE_LABEL: Record<GroupType, string> = {
  [GroupType.GENERAL]:   'Geral',
  [GroupType.SECTOR]:    'Setor',
  [GroupType.SUBSECTOR]: 'Subsetor',
  [GroupType.PROJECT]:   'Projeto',
  [GroupType.TEMPORARY]: 'Temporário',
  [GroupType.PRIVATE]:   'Privado',
}

/**
 * Display name for a group. Direct messages (PRIVATE) store an internal
 * `direct:<id>:<id>` name, so show the other participant's name instead.
 */
function groupDisplayName(group: Group): string {
  if (group.type === GroupType.PRIVATE) {
    return group.directPeer?.name ?? 'Conversa direta'
  }
  return group.name
}

/**
 * Orders the group list so SUBSECTOR groups appear indented directly under their
 * parent SECTOR (organizational tree — plano 22 §4). The tree is purely visual;
 * a group whose parent isn't in the list (e.g. not a member) renders at the top
 * level. Preserves the backend ordering (most-recent first) among roots.
 */
function orderGroupsHierarchically(groups: Group[]): { group: Group; depth: number }[] {
  const byId = new Map(groups.map((g) => [g.id, g]))
  const childrenByParent = new Map<string, Group[]>()
  const roots: Group[] = []
  for (const g of groups) {
    const parent = g.parentId ? byId.get(g.parentId) : undefined
    if (parent && parent.type === GroupType.SECTOR && parent.id !== g.id) {
      const siblings = childrenByParent.get(parent.id) ?? []
      siblings.push(g)
      childrenByParent.set(parent.id, siblings)
    } else {
      roots.push(g)
    }
  }
  const ordered: { group: Group; depth: number }[] = []
  for (const root of roots) {
    ordered.push({ group: root, depth: 0 })
    if (root.type === GroupType.SECTOR) {
      for (const child of childrenByParent.get(root.id) ?? []) {
        ordered.push({ group: child, depth: 1 })
      }
    }
  }
  return ordered
}

// ─── Message bubble ───────────────────────────────────────────────────────────

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏']

const MessageBubble = memo(function MessageBubble({
  msg,
  isMine,
  currentUserId,
  isBookmarked,
  isFlashing,
  customEmojis,
  onDelete,
  onPin,
  onReply,
  onReact,
  onBookmark,
  onOpenThread,
}: {
  msg: Message
  isMine: boolean
  currentUserId: string
  isBookmarked: boolean
  isFlashing: boolean
  customEmojis: Map<string, string>
  onDelete: (msg: Message) => void
  onPin: (msg: Message) => void
  onReply: (msg: Message) => void
  onReact: (messageId: string, emoji: string) => void
  onBookmark: (msg: Message, isBookmarked: boolean) => void
  onOpenThread: (messageId: string) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isFlashing) rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [isFlashing])
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
      ref={rootRef}
      className={clsx(
        'flex gap-2 mb-2 group rounded-xl p-1 -m-1 transition-colors',
        isMine && 'flex-row-reverse',
        isFlashing && 'bg-yellow-100',
        msg.pending && 'opacity-60',
      )}
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
          {msg.content && <span>{renderContent(msg.content, customEmojis)}</span>}
          {msg.isPinned && (
            <i className="ti ti-pin text-[10px] ml-1.5 opacity-60" aria-hidden="true" />
          )}
        </div>

        <div className="flex items-center gap-1 mt-0.5 px-1">
          <span className="text-[10px] text-gx">
            {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {msg.isEdited && <span className="text-[10px] text-gx">(editado)</span>}
          {msg.pending && (
            <span className="text-[10px] text-gx flex items-center gap-0.5" title="Enviando…">
              <i className="ti ti-clock text-[11px]" aria-hidden="true" />
              enviando…
            </span>
          )}
          {msg.failed && (
            <span className="text-[10px] text-red-400 flex items-center gap-0.5" title="Falha no envio">
              <i className="ti ti-alert-circle text-[11px]" aria-hidden="true" />
              não enviada
            </span>
          )}
        </div>

        {/* Reply count indicator (opens thread) */}
        {msg._count && msg._count.replies > 0 && (
          <button
            onClick={() => onOpenThread(msg.id)}
            className="mt-1 px-2 py-0.5 self-start text-[11px] font-medium text-gd bg-gd/5 hover:bg-gd/10 rounded-full transition-colors flex items-center gap-1"
          >
            <i className="ti ti-message-circle-2 text-xs" aria-hidden="true" />
            {msg._count.replies} {msg._count.replies === 1 ? 'resposta' : 'respostas'}
          </button>
        )}

        {/* Reaction bubbles */}
        {Object.keys(reactionSummary).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {Object.entries(reactionSummary).map(([emoji, { count, isMine: mine }]) => (
              <button
                key={emoji}
                onClick={() => onReact(msg.id, emoji)}
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

      {/* Hover actions — hidden while the message is still optimistic (no real id yet) */}
      <div
        className={clsx(
          'self-center flex items-center gap-1 transition-opacity relative',
          hover && !msg.pending ? 'opacity-100' : 'opacity-0 pointer-events-none',
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
                  onClick={() => { onReact(msg.id, e); setEmojiOpen(false) }}
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
          onClick={() => onReply(msg)}
          className="p-1 rounded-lg text-gx hover:bg-page-bg hover:text-gray-700 transition-colors"
          aria-label="Responder"
          title="Responder"
        >
          <i className="ti ti-corner-up-left text-sm" aria-hidden="true" />
        </button>
        <button
          onClick={() => onOpenThread(msg.id)}
          className="p-1 rounded-lg text-gx hover:bg-page-bg hover:text-gray-700 transition-colors"
          aria-label="Abrir conversa"
          title="Abrir conversa"
        >
          <i className="ti ti-message-circle-2 text-sm" aria-hidden="true" />
        </button>
        <button
          onClick={() => onPin(msg)}
          className="p-1 rounded-lg text-gx hover:bg-page-bg hover:text-gray-700 transition-colors"
          aria-label={msg.isPinned ? 'Desafixar' : 'Fixar'}
          title={msg.isPinned ? 'Desafixar' : 'Fixar'}
        >
          <i className={clsx('ti text-sm', msg.isPinned ? 'ti-pin-filled text-gd' : 'ti-pin')} aria-hidden="true" />
        </button>
        <button
          onClick={() => onBookmark(msg, isBookmarked)}
          className="p-1 rounded-lg text-gx hover:bg-page-bg hover:text-gray-700 transition-colors"
          aria-label={isBookmarked ? 'Remover dos salvos' : 'Salvar'}
          title={isBookmarked ? 'Remover dos salvos' : 'Salvar'}
        >
          <i
            className={clsx('ti text-sm', isBookmarked ? 'ti-bookmark-filled text-gd' : 'ti-bookmark')}
            aria-hidden="true"
          />
        </button>
        {isMine && (
          <button
            onClick={() => onDelete(msg)}
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
})

// ─── Group list item ──────────────────────────────────────────────────────────

function GroupItem({
  group,
  active,
  onClick,
  onlineCount = 0,
  depth = 0,
}: {
  group: Group
  active: boolean
  onClick: () => void
  onlineCount?: number
  /** Nesting level in the sector→subsector tree (0 = root). Indents the row. */
  depth?: number
}) {
  const displayName = groupDisplayName(group)

  return (
    <button
      onClick={onClick}
      style={depth > 0 ? { paddingLeft: 12 + depth * 18 } : undefined}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors',
        active ? 'bg-gd/10 text-gd' : 'hover:bg-page-bg text-gray-700',
        depth > 0 && 'border-l-2 border-gs/50 rounded-l-none',
      )}
    >
      <div className="relative shrink-0">
        <div
          className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden',
            active ? 'bg-gd/20' : 'bg-page-bg',
          )}
        >
          {group.type === GroupType.PRIVATE && group.directPeer?.avatarUrl ? (
            // Direct message: show the other participant's photo when available.
            <img
              src={group.directPeer.avatarUrl}
              alt={group.directPeer.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <i
              className={clsx(
                'ti text-lg',
                // DMs without a photo fall back to a user icon, not the type icon.
                group.type === GroupType.PRIVATE ? 'ti-user' : GROUP_TYPE_ICON[group.type],
                active ? 'text-gd' : 'text-gx',
              )}
              aria-hidden="true"
            />
          )}
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
      {(group.unreadCount ?? 0) > 0 && (
        <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-gd text-white text-[10px] font-semibold flex items-center justify-center">
          {group.unreadCount! > 99 ? '99+' : group.unreadCount}
        </span>
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
  const { data: groups = [] } = useGroups()
  const [name, setName] = useState('')
  const [type, setType] = useState<GroupType>(GroupType.SECTOR)
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [parentId, setParentId] = useState('')

  // Subsectors hang under a parent sector (organizational tree — plano 22 §4).
  const sectors = groups.filter((g) => g.type === GroupType.SECTOR)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    create(
      {
        name,
        type,
        description: description || undefined,
        visibility: isPublic ? GroupVisibility.UNIT_PUBLIC : GroupVisibility.PRIVATE_INVITE,
        parentId: type === GroupType.SUBSECTOR && parentId ? parentId : undefined,
      },
      {
        onSuccess: () => {
          onClose()
          setName('')
          setDescription('')
          setIsPublic(false)
          setParentId('')
        },
      },
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
        {type === GroupType.SUBSECTOR && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Setor pai</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd text-gray-700"
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
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-gd"
          />
          <span className="text-xs text-gray-700">
            <span className="font-semibold">Público nesta unidade</span>
            <span className="block text-[11px] text-gx mt-0.5">
              Qualquer pessoa da unidade pode encontrar e entrar no grupo sem convite.
            </span>
          </span>
        </label>
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

export default function MensagensPage() {
  // useSearchParams() requires a Suspense boundary during static prerender.
  return (
    <Suspense fallback={<div className="p-6 text-gx text-sm">Carregando…</div>}>
      <MensagensPageInner />
    </Suspense>
  )
}

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
  const [searchOpen, setSearchOpen] = useState(false)
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null)
  const [threadParentId, setThreadParentId] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<'mine' | 'discover'>('mine')
  const canManageGroups = user
    ? user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.DIRETORIA ||
      user.role === UserRole.GESTOR
    : false
  const { data: discoverableGroups = [] } = useDiscoverableGroups()
  const { mutate: joinGroup, isPending: joining } = useJoinGroup()
  const { data: activeHuddle } = useActiveHuddle(activeGroupId)
  const { mutateAsync: startHuddle, isPending: startingHuddle } = useStartHuddle()
  const { mutateAsync: joinHuddleApi, isPending: joiningHuddle } = useJoinHuddle()
  const [huddleSession, setHuddleSession] = useState<HuddleTokenResponse | null>(null)
  // Running call duration shown next to the conversation name in the header.
  const callElapsed = useElapsed(activeHuddle?.startedAt ?? null)

  async function handleStartHuddle() {
    if (!activeGroupId) return
    try {
      const session = await startHuddle(activeGroupId)
      setHuddleSession(session)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  async function handleJoinHuddle() {
    if (!activeHuddle) return
    try {
      const session = await joinHuddleApi(activeHuddle.id)
      setHuddleSession(session)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null
  // Current user's role in the active group (findAll returns only the caller's membership).
  const myRole = activeGroup?.members?.[0]?.role ?? null
  const isGroupAdmin = myRole === 'ADMIN'
  // Posting is blocked for read-only viewers and for non-admins in admins-only groups.
  const canPost =
    !!activeGroup &&
    myRole !== 'VIEWER' &&
    !(activeGroup.onlyAdminsPost && !isGroupAdmin)

  // Auto-select group from ?group= or ?groupId= URL param
  useEffect(() => {
    const groupParam = searchParams.get('group') ?? searchParams.get('groupId')
    if (groupParam && groups.length > 0) {
      const found = groups.find((g) => g.id === groupParam)
      if (found) setActiveGroupId(groupParam)
    }
  }, [searchParams, groups])

  // Deep-link: flash a specific messageId after opening a group via search
  useEffect(() => {
    const messageId = searchParams.get('messageId')
    if (!messageId) return
    setFlashMessageId(messageId)
    const timer = setTimeout(() => setFlashMessageId(null), 3500)
    return () => clearTimeout(timer)
  }, [searchParams])

  // Deep-link: open thread panel from ?thread=<messageId>
  useEffect(() => {
    const threadId = searchParams.get('thread')
    if (threadId) setThreadParentId(threadId)
  }, [searchParams])

  // Ctrl+K / Cmd+K opens search panel
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

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
  const { mutate: toggleBookmark } = useToggleBookmark()
  const { data: bookmarksData } = useBookmarks()
  const bookmarkedIds = useMemo(
    () => new Set(bookmarksData?.pages.flatMap((p) => p.bookmarks.map((b) => b.messageId)) ?? []),
    [bookmarksData],
  )
  const { data: customEmojiList = [] } = useCustomEmojis()
  const customEmojis = useMemo(
    () => new Map(customEmojiList.map((e) => [e.shortcode, e.url])),
    [customEmojiList],
  )
  const { mutateAsync: createReminder } = useCreateReminder()
  const [slashFeedback, setSlashFeedback] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const { onInputChange } = useTypingIndicator(activeGroupId)
  const { sendFiles, uploading } = useFileAttachment(activeGroupId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { notices: systemNotices, dismiss: dismissNotice } = useGroupSystemEvents(activeGroupId)
  const { mutate: markGroupRead } = useMarkGroupRead()

  // Stable per-message handlers so the memoized MessageBubble doesn't re-render
  // every keystroke. Mutate fns from TanStack Query are already stable refs.
  const handleDeleteMsg = useCallback((m: Message) => deleteMsg(m.id), [deleteMsg])
  const handlePinMsg = useCallback((m: Message) => pinMsg(m.id), [pinMsg])
  const handleReplyMsg = useCallback((m: Message) => setReplyTo(m), [])
  const handleReactMsg = useCallback(
    (messageId: string, emoji: string) => toggleReaction({ messageId, emoji }),
    [toggleReaction],
  )
  const handleBookmarkMsg = useCallback(
    (m: Message, isBookmarked: boolean) => toggleBookmark({ messageId: m.id, isBookmarked }),
    [toggleBookmark],
  )
  const handleOpenThread = useCallback((messageId: string) => {
    setThreadParentId(messageId)
    setSearchOpen(false)
  }, [])

  // Flatten infinite pages into a single chronological (oldest → newest) array.
  // Page 0 holds the newest messages and each subsequent page (fetched via the
  // "load older" cursor) holds older ones, so pages must be reversed before the
  // flatten — otherwise the newest block renders above the older block.
  const messages = [...(messagesData?.pages ?? [])].reverse().flatMap((p) => p.messages)


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

  // Mark the open group as read — on open and whenever a new message arrives
  // while it's the active conversation. Clears its unread badge.
  useEffect(() => {
    if (activeGroupId) markGroupRead(activeGroupId)
  }, [activeGroupId, messages.length, markGroupRead])

  async function send() {
    const content = text.trim()
    if (!content || !activeGroupId) return

    // Try to interpret as slash command first.
    const parsed = parseSlash(content)
    if (parsed) {
      const result = await parsed.command.run(parsed.args, {
        groupId: activeGroupId,
        sendMessage: (text) => sendMsg({ content: text, replyToId: replyTo?.id ?? undefined }),
        createReminder: async (input) => { await createReminder(input) },
      })
      if (result.kind === 'error') {
        setSlashFeedback({ tone: 'error', text: result.message })
        return
      }
      if (result.kind === 'noop' && result.message) {
        setSlashFeedback({ tone: 'info', text: result.message })
      } else {
        setSlashFeedback(null)
      }
      setText('')
      setReplyTo(null)
      setMentionQuery('')
      setMentionStart(-1)
      return
    }

    setSlashFeedback(null)
    sendMsg({ content, replyToId: replyTo?.id })
    setText('')
    setReplyTo(null)
    setMentionQuery('')
    setMentionStart(-1)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    e.target.value = ''
    void sendFiles(files)
  }

  // Drag-and-drop: dropping files anywhere over the chat panel uploads + sends them.
  function handleDragOver(e: React.DragEvent) {
    if (!activeGroupId) return
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear when leaving the panel itself, not when moving over children.
    if (e.currentTarget === e.target) setDragActive(false)
  }

  function handleDrop(e: React.DragEvent) {
    if (!activeGroupId) return
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files.length > 0) void sendFiles(e.dataTransfer.files)
  }

  // Clipboard paste of an image/file (e.g. a screenshot) attaches it.
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.items)
      .filter((it) => it.kind === 'file')
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null)
    if (files.length > 0) {
      e.preventDefault()
      void sendFiles(files)
    }
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
              onClick={() => setSearchOpen((v) => !v)}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                searchOpen ? 'bg-gd/10 text-gd' : 'text-gx hover:bg-page-bg hover:text-gd',
              )}
              aria-label="Buscar mensagens (Ctrl+K)"
              title="Buscar mensagens (Ctrl+K)"
            >
              <i className="ti ti-search text-base" aria-hidden="true" />
            </button>
            <a
              href="/mensagens/salvos"
              className="p-1.5 rounded-lg text-gx hover:bg-page-bg hover:text-gd transition-colors"
              aria-label="Mensagens salvas"
              title="Mensagens salvas"
            >
              <i className="ti ti-bookmark text-base" aria-hidden="true" />
            </a>
            <a
              href="/configuracoes/emojis"
              className="p-1.5 rounded-lg text-gx hover:bg-page-bg hover:text-gd transition-colors"
              aria-label="Emojis customizados"
              title="Emojis customizados"
            >
              <i className="ti ti-mood-smile text-base" aria-hidden="true" />
            </a>
            <button
              onClick={() => setDmOpen(true)}
              className="p-1.5 rounded-lg text-gx hover:bg-page-bg hover:text-gd transition-colors"
              aria-label="Nova conversa direta"
              title="Nova conversa direta"
            >
              <i className="ti ti-user-plus text-base" aria-hidden="true" />
            </button>
            {canManageGroups && (
              <button
                onClick={() => setCreateOpen(true)}
                className="p-1.5 rounded-lg text-gx hover:bg-page-bg hover:text-gd transition-colors"
                aria-label="Novo grupo"
                title="Novo grupo"
              >
                <i className="ti ti-plus text-base" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs — only relevant when there's a Discover tab to show */}
        {canManageGroups && (
          <div className="flex px-2 pt-2 gap-1 shrink-0 border-b border-gs/40">
            <button
              onClick={() => setSidebarTab('mine')}
              className={clsx(
                'flex-1 text-xs font-medium py-1.5 rounded-t-lg border-b-2',
                sidebarTab === 'mine'
                  ? 'border-gd text-gd'
                  : 'border-transparent text-gx hover:text-gray-700',
              )}
            >
              Meus
            </button>
            <button
              onClick={() => setSidebarTab('discover')}
              className={clsx(
                'flex-1 text-xs font-medium py-1.5 rounded-t-lg border-b-2 flex items-center justify-center gap-1',
                sidebarTab === 'discover'
                  ? 'border-gd text-gd'
                  : 'border-transparent text-gx hover:text-gray-700',
              )}
            >
              Descobrir
              {discoverableGroups.length > 0 && (
                <span className="text-[10px] bg-gd/10 text-gd px-1.5 py-0.5 rounded-full">
                  {discoverableGroups.length}
                </span>
              )}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sidebarTab === 'mine' ? (
            loadingGroups ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-gs/30 animate-pulse mx-1 mb-1" />
              ))
            ) : groups.length === 0 ? (
              <div className="py-10 text-center">
                <i className="ti ti-message-off text-3xl text-gx mb-2 block" aria-hidden="true" />
                <p className="text-xs text-gx">Nenhum grupo</p>
              </div>
            ) : (
              orderGroupsHierarchically(groups).map(({ group: g, depth }) => {
                const memberIds = g.members?.map((m) => m.userId) ?? []
                const onlineCount = memberIds.filter((id) => onlineIds.includes(id) && id !== user?.id).length
                return (
                  <GroupItem
                    key={g.id}
                    group={g}
                    depth={depth}
                    active={g.id === activeGroupId}
                    onClick={() => setActiveGroupId(g.id)}
                    onlineCount={onlineCount}
                  />
                )
              })
            )
          ) : (
            discoverableGroups.length === 0 ? (
              <div className="py-10 text-center px-2">
                <i className="ti ti-compass-off text-3xl text-gx mb-2 block" aria-hidden="true" />
                <p className="text-xs text-gx">Nenhum grupo público disponível.</p>
              </div>
            ) : (
              discoverableGroups.map((g) => (
                <div
                  key={g.id}
                  className="px-3 py-2.5 rounded-xl border border-gs/40 hover:border-gd/30 transition-colors mb-1"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <i
                      className={clsx('ti text-base text-gd', GROUP_TYPE_ICON[g.type])}
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-gray-800 truncate flex-1">{g.name}</p>
                  </div>
                  {g.description && (
                    <p className="text-[11px] text-gx mb-2 line-clamp-2">{g.description}</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-gx">
                      {g._count.members} {g._count.members === 1 ? 'membro' : 'membros'}
                    </span>
                    <button
                      onClick={() =>
                        joinGroup(g.id, {
                          onSuccess: () => {
                            setSidebarTab('mine')
                            setActiveGroupId(g.id)
                          },
                        })
                      }
                      disabled={joining}
                      className="text-[11px] font-medium text-white bg-gd px-2 py-1 rounded-lg hover:opacity-90 disabled:opacity-40"
                    >
                      Entrar
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </aside>

      {/* Chat panel */}
      {activeGroup ? (
        <div
          className="flex-1 flex flex-col overflow-hidden relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag-and-drop overlay */}
          {dragActive && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-page-bg/90 border-2 border-dashed border-gd rounded-2xl pointer-events-none">
              <i className="ti ti-upload text-4xl text-gd" aria-hidden="true" />
              <p className="text-sm font-medium text-gd">Solte para enviar</p>
            </div>
          )}
          {/* Chat header */}
          <div className="h-14 bg-white border-b border-gs/60 px-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <i
                className={clsx('ti text-xl text-gd', GROUP_TYPE_ICON[activeGroup.type])}
                aria-hidden="true"
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-800">{groupDisplayName(activeGroup)}</p>
                  {activeHuddle && (
                    <span
                      className="flex items-center gap-1 rounded-full bg-gn/15 px-2 py-0.5 text-[11px] font-semibold text-gd tabular-nums"
                      title="Tempo de chamada em andamento"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                      {callElapsed}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gx">
                  {activeGroup.type === GroupType.PRIVATE
                    ? 'Conversa direta'
                    : `${activeGroup._count?.members ?? 0} membros · ${GROUP_TYPE_LABEL[activeGroup.type]}`}
                </p>
              </div>
              {!huddleSession && (
                activeHuddle ? (
                  <button
                    onClick={handleJoinHuddle}
                    disabled={joiningHuddle}
                    className="ml-2 flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-gd rounded-full hover:opacity-90 disabled:opacity-50"
                  >
                    <i className="ti ti-headphones text-sm" aria-hidden="true" />
                    Entrar na chamada ({activeHuddle.participantCount})
                  </button>
                ) : (
                  <button
                    onClick={handleStartHuddle}
                    disabled={startingHuddle}
                    className="ml-2 flex items-center gap-1.5 px-2.5 py-1 text-xs text-gd border border-gd/30 rounded-full hover:bg-gd/5 disabled:opacity-50"
                    title="Iniciar chamada"
                  >
                    <i className="ti ti-headphones text-sm" aria-hidden="true" />
                    Chamada
                  </button>
                )
              )}
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
              {isGroupAdmin && activeGroup.type !== GroupType.PRIVATE && (
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="p-2 rounded-lg text-gx hover:bg-page-bg hover:text-gd transition-colors"
                  aria-label="Configurações do grupo"
                  title="Configurações do grupo"
                >
                  <i className="ti ti-settings text-base" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Objective progress strip (project feed — Integração 1): shows the
              linked objective's bottom-up progress so the team sees the work
              advance in the same place they talk. */}
          {activeGroup.objective && (
            <div className="bg-white border-b border-gs/60 px-5 py-1.5 flex items-center gap-3 shrink-0">
              <i className="ti ti-target text-gx text-sm shrink-0" aria-hidden="true" />
              <span className="text-[11px] text-gx truncate max-w-[45%]" title={activeGroup.objective.title}>
                {activeGroup.objective.title}
              </span>
              <div className="flex-1 min-w-0">
                <ProgressBar value={activeGroup.objective.progressPct} showLabel size="sm" />
              </div>
            </div>
          )}

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
                  isBookmarked={bookmarkedIds.has(msg.id)}
                  isFlashing={flashMessageId === msg.id}
                  customEmojis={customEmojis}
                  onDelete={handleDeleteMsg}
                  onPin={handlePinMsg}
                  onReply={handleReplyMsg}
                  onReact={handleReactMsg}
                  onBookmark={handleBookmarkMsg}
                  onOpenThread={handleOpenThread}
                />
              ))
            )}

            {/* Ephemeral system notices (impediments etc.) — not persisted */}
            {systemNotices.map((n) => (
              <div
                key={n.id}
                className={clsx(
                  'flex items-center gap-2 mx-auto my-2 max-w-md px-3 py-1.5 rounded-full text-xs border',
                  n.tone === 'danger' && 'bg-red-50 border-red-200 text-red-600',
                  n.tone === 'warning' && 'bg-amber-50 border-amber-200 text-amber-700',
                  n.tone === 'success' && 'bg-gd/5 border-gd/20 text-gd',
                  n.tone === 'info' && 'bg-page-bg border-gs/60 text-gx',
                )}
              >
                <i className={clsx('ti shrink-0', `ti-${n.icon}`)} aria-hidden="true" />
                <span className="flex-1">{n.text}</span>
                {n.href && (
                  <a href={n.href} className="font-medium underline shrink-0">
                    Ver
                  </a>
                )}
                <button
                  onClick={() => dismissNotice(n.id)}
                  className="shrink-0 opacity-60 hover:opacity-100"
                  aria-label="Dispensar aviso"
                >
                  <i className="ti ti-x text-[11px]" aria-hidden="true" />
                </button>
              </div>
            ))}

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

          {/* Slash command suggestions */}
          {text.startsWith('/') && !text.includes(' ') && (
            <div className="px-4 pt-2 bg-white border-t border-gs/60 shrink-0">
              <ul className="bg-white border border-gs/60 rounded-xl text-xs overflow-hidden">
                {SLASH_COMMANDS.filter((c) => c.name.startsWith(text.slice(1))).map((c) => (
                  <li
                    key={c.name}
                    onClick={() => {
                      setText(`/${c.name} `)
                      textareaRef.current?.focus()
                    }}
                    className="px-3 py-1.5 hover:bg-page-bg cursor-pointer flex items-baseline gap-2"
                  >
                    <code className="font-semibold text-gd">/{c.name}</code>
                    <span className="text-gx">— {c.description}</span>
                    <span className="ml-auto text-[10px] text-gx">{c.usage}</span>
                  </li>
                ))}
                {SLASH_COMMANDS.filter((c) => c.name.startsWith(text.slice(1))).length === 0 && (
                  <li className="px-3 py-1.5 text-gx italic">
                    Nenhum comando encontrado para “{text}”.
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Slash feedback */}
          {slashFeedback && (
            <div
              className={clsx(
                'px-4 py-1.5 text-xs flex items-center gap-2 border-t border-gs/60',
                slashFeedback.tone === 'error' ? 'bg-red-50 text-red-600' : 'bg-page-bg text-gd',
              )}
            >
              <i
                className={clsx(
                  'ti text-sm',
                  slashFeedback.tone === 'error' ? 'ti-alert-circle' : 'ti-info-circle',
                )}
                aria-hidden="true"
              />
              <span className="flex-1">{slashFeedback.text}</span>
              <button
                onClick={() => setSlashFeedback(null)}
                className="text-gx hover:text-gray-700"
                aria-label="Fechar"
              >
                <i className="ti ti-x text-sm" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Input bar — hidden for viewers and non-admins in admins-only groups */}
          {!canPost ? (
            <div className="px-4 py-3 bg-white border-t border-gs/60 shrink-0 text-center">
              <p className="text-xs text-gx flex items-center justify-center gap-1.5">
                <i className="ti ti-eye text-sm" aria-hidden="true" />
                {myRole === 'VIEWER'
                  ? 'Você tem acesso somente leitura neste grupo.'
                  : 'Somente administradores podem enviar mensagens neste grupo.'}
              </p>
            </div>
          ) : (
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
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              />
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={onKeyDown}
                onPaste={handlePaste}
                placeholder="Mensagem... (@ para mencionar, / para comandos)"
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
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <i className="ti ti-message-2 text-5xl text-gx" aria-hidden="true" />
          <p className="text-sm text-gray-600 font-medium">Selecione um grupo para conversar</p>
          {canManageGroups && (
            <button
              onClick={() => setCreateOpen(true)}
              className="text-sm text-gd hover:underline"
            >
              ou crie um novo grupo
            </button>
          )}
        </div>
      )}

      {threadParentId && activeGroupId ? (
        <ThreadPanel
          groupId={activeGroupId}
          parentId={threadParentId}
          currentUserId={user?.id ?? ''}
          onClose={() => {
            setThreadParentId(null)
            const url = new URL(window.location.href)
            url.searchParams.delete('thread')
            window.history.replaceState(null, '', url.toString())
          }}
        />
      ) : searchOpen ? (
        <SearchPanel
          currentGroupId={activeGroupId}
          onClose={() => setSearchOpen(false)}
          onJumpToMessage={(r) => {
            setActiveGroupId(r.groupId)
            setFlashMessageId(r.id)
            setSearchOpen(false)
            window.history.replaceState(
              null,
              '',
              `/mensagens?groupId=${r.groupId}&messageId=${r.id}`,
            )
          }}
        />
      ) : null}

      {huddleSession && (
        <HuddleMini session={huddleSession} onLeave={() => setHuddleSession(null)} />
      )}

      <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <StartDirectModal
        open={dmOpen}
        onClose={() => setDmOpen(false)}
        onSelect={handleStartDirect}
      />
      {activeGroup && (
        <GroupSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          group={activeGroup}
          currentUserId={user?.id}
        />
      )}
    </div>
  )
}
