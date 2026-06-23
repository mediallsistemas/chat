'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { getSocket } from '@/shared/lib/socket'
import { useUnitStore } from '@/shared/store/unit-store'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { toast } from '@/shared/hooks/use-toast'
import { getErrorMessage } from '@/shared/lib/get-error-message'
import { MessageType } from '@mediall/types'
import type {
  Group,
  Message,
  GroupType,
  GroupVisibility,
  GroupMemberRole,
  UpdateGroupInput,
  DiscoverableGroup,
  MessageReactionSummary,
  BookmarksPage,
  CustomEmoji,
  ChatReminder,
  ChatSearchPage,
  ThreadView,
  Huddle,
  HuddleTokenResponse,
} from '@mediall/types'

function getUrl(unitId: string, path: string) {
  return `/units/${unitId}${path}`
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export function useGroups() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useQuery<Group[]>({
    queryKey: ['groups', activeUnit?.id],
    queryFn: async () => {
      const res = await api.get<{ data: Group[] }>(getUrl(activeUnit!.id, '/groups'))
      return res.data.data
    },
    enabled: !!activeUnit,
  })
}

export function useCreateGroup() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: {
      name: string
      description?: string
      type: GroupType
      visibility?: GroupVisibility
      parentId?: string
      onlyAdminsPost?: boolean
      archiveAt?: string
    }) => api.post(getUrl(activeUnit!.id, '/groups'), dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] }),
  })
}

export function useDiscoverableGroups() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useQuery<DiscoverableGroup[]>({
    queryKey: ['groups', activeUnit?.id, 'discoverable'],
    queryFn: async () => {
      const res = await api.get<{ data: DiscoverableGroup[] }>(
        getUrl(activeUnit!.id, '/groups/discoverable'),
      )
      return res.data.data
    },
    enabled: !!activeUnit,
  })
}

export function useJoinGroup() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (groupId: string) =>
      api.post(getUrl(activeUnit!.id, `/groups/${groupId}/join`), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] })
      qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id, 'discoverable'] })
    },
  })
}

export function useArchiveGroup() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (groupId: string) =>
      api.patch(getUrl(activeUnit!.id, `/groups/${groupId}/archive`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] }),
  })
}

export function useMarkGroupRead() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (groupId: string) =>
      api.post(getUrl(activeUnit!.id, `/groups/${groupId}/read`), {}),
    onSuccess: (_res, groupId) => {
      // Zero the badge locally without a full refetch.
      qc.setQueryData<Group[]>(['groups', activeUnit?.id], (old) =>
        old?.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)),
      )
    },
  })
}

export function useUpdateGroup(groupId: string) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateGroupInput) =>
      api.patch(getUrl(activeUnit!.id, `/groups/${groupId}`), dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] })
      toast.success('Grupo atualizado.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useUpdateMemberRole(groupId: string) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: GroupMemberRole }) =>
      api.patch(getUrl(activeUnit!.id, `/groups/${groupId}/members/${userId}/role`), { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] })
      qc.invalidateQueries({ queryKey: ['group-members', groupId] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useRemoveMember(groupId: string) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      api.delete(getUrl(activeUnit!.id, `/groups/${groupId}/members/${userId}`)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] })
      qc.invalidateQueries({ queryKey: ['group-members', groupId] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

/**
 * Members of a group with resolved names/avatars. Combines the group's member
 * roster (id + role) with the unit member directory (id → name/avatar).
 */
export function useGroupMembers(groupId: string | null) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      const [groupRes, dirRes] = await Promise.all([
        api.get<{ data: { members: { userId: string; role: GroupMemberRole }[] } }>(
          getUrl(activeUnit!.id, `/groups/${groupId}`),
        ),
        api.get<{ data: { id: string; name: string; avatarUrl: string | null }[] }>(
          getUrl(activeUnit!.id, '/members'),
        ),
      ])
      const dir = new Map(dirRes.data.data.map((u) => [u.id, u]))
      return groupRes.data.data.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        name: dir.get(m.userId)?.name ?? 'Usuário',
        avatarUrl: dir.get(m.userId)?.avatarUrl ?? null,
      }))
    },
    enabled: !!activeUnit && !!groupId,
  })
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface MessagesPage {
  messages: Message[]
  nextCursor: string | null
}

/**
 * Apply a reaction summary to the cached message list (and per-message reaction
 * cache). Shared by the `message:reaction` socket echo and the toggle mutation's
 * onSuccess, so a reaction shows instantly for the sender without depending on
 * the socket round-trip. Idempotent: rebuilds the flat reaction list from the
 * summary, so applying it twice (mutation + echo) converges to the same state.
 */
function applyReactionSummary(
  qc: ReturnType<typeof useQueryClient>,
  groupId: string | null,
  payload: MessageReactionSummary,
  currentUserId: string | undefined,
) {
  if (!groupId) return
  qc.setQueryData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
    ['messages', groupId],
    (old) => {
      if (!old) return old
      return {
        ...old,
        pages: old.pages.map((p) => ({
          ...p,
          messages: p.messages.map((m) =>
            m.id === payload.messageId
              ? {
                  ...m,
                  reactions: payload.reactions.flatMap((r) => {
                    const mine = !!currentUserId && payload.myReactions.includes(r.emoji)
                    return Array.from({ length: r.count }, (_, i) => ({
                      emoji: r.emoji,
                      userId: mine && i === 0 ? currentUserId! : `other:${i}`,
                    }))
                  }),
                }
              : m,
          ),
        })),
      }
    },
  )
  qc.setQueryData(['reactions', payload.messageId], payload)
}

export function useMessages(groupId: string | null) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const qc = useQueryClient()

  const query = useInfiniteQuery<MessagesPage>({
    queryKey: ['messages', groupId],
    queryFn: async ({ pageParam }) => {
      const url = getUrl(activeUnit!.id, `/groups/${groupId}/messages`)
      const res = await api.get<{ data: MessagesPage }>(url, {
        params: pageParam ? { cursor: pageParam } : {},
      })
      return res.data.data
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!activeUnit && !!groupId,
  })

  // Socket.IO real-time updates
  useEffect(() => {
    if (!groupId) return
    const socket = getSocket()

    socket.emit('join:group', groupId)

    function onNew(msg: Message) {
      // Thread replies belong in the thread panel only (handled by useThread),
      // never in the channel timeline — Slack-style. Skip them here.
      if (msg.replyToId) return
      qc.setQueryData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
        ['messages', groupId],
        (old) => {
          if (!old || old.pages.length === 0) return old
          // Page 0 holds the newest messages (each page is ordered oldest → newest).
          // A freshly arrived message is the newest, so it is appended to page 0.
          const pages = [...old.pages]
          const first = { ...pages[0] }
          // Already have the real message (e.g. our own send already reconciled
          // it via the mutation's onSuccess) → nothing to do.
          if (first.messages.some((m) => m.id === msg.id)) return old
          // Drop any optimistic placeholder this real message supersedes: our own
          // pending send for the same content. Prevents a duplicate when the
          // socket broadcast races the POST response.
          const withoutOptimistic =
            msg.senderId === currentUserId
              ? first.messages.filter(
                  (m) => !(m.pending && m.senderId === msg.senderId && m.content === msg.content),
                )
              : first.messages
          first.messages = [...withoutOptimistic, msg]
          pages[0] = first
          return { ...old, pages }
        },
      )
    }

    function onEdited(msg: Message) {
      qc.setQueryData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
        ['messages', groupId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              messages: p.messages.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)),
            })),
          }
        },
      )
    }

    function onDeleted({ id }: { id: string }) {
      qc.setQueryData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
        ['messages', groupId],
        (old) => {
          if (!old) return old
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              messages: p.messages.map((m) =>
                m.id === id ? { ...m, isDeleted: true } : m,
              ),
            })),
          }
        },
      )
    }

    function onReaction(payload: MessageReactionSummary) {
      applyReactionSummary(qc, groupId, payload, currentUserId)
    }

    // A group edit (name/cover/role/rules) → refresh the group list so the
    // header and sidebar reflect it live for every member in the room.
    function onGroupUpdated() {
      qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] })
    }

    socket.on('message:new', onNew)
    socket.on('message:edited', onEdited)
    socket.on('message:deleted', onDeleted)
    socket.on('message:reaction', onReaction)
    socket.on('group:updated', onGroupUpdated)

    return () => {
      socket.emit('leave:group', groupId)
      socket.off('message:new', onNew)
      socket.off('message:edited', onEdited)
      socket.off('message:deleted', onDeleted)
      socket.off('message:reaction', onReaction)
      socket.off('group:updated', onGroupUpdated)
    }
  }, [groupId, qc, currentUserId, activeUnit?.id])

  return query
}

interface SendMessageDto {
  content: string
  replyToId?: string
  fileKey?: string
  fileName?: string
  fileSize?: number
  fileMime?: string
}

type MessagesCache = { pages: MessagesPage[]; pageParams: unknown[] }

/**
 * Sends a chat message with an optimistic insert: the bubble shows up the moment
 * the user hits send (flagged `pending`), then is reconciled against the real
 * message returned by the POST. On failure the placeholder is marked `failed`
 * and a toast is shown. Reconciliation also guards the socket `message:new`
 * broadcast (which echoes back to the sender) from creating a duplicate.
 */
export function useSendMessage(groupId: string) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const currentUser = useAuthStore((s) => s.user)
  const qc = useQueryClient()
  const key = ['messages', groupId] as const

  return useMutation({
    mutationFn: (dto: SendMessageDto) =>
      api.post<{ data: Message }>(getUrl(activeUnit!.id, `/groups/${groupId}/messages`), dto),

    onMutate: async (dto) => {
      // Thread replies are not part of the channel timeline (Slack-style), so we
      // don't insert an optimistic bubble there — the thread panel handles its
      // own live update via the socket. Skip optimistic for replies.
      if (dto.replyToId) return { tempId: null }

      // File-only sends are driven elsewhere; still optimistic, but text is the
      // common path. Cancel in-flight refetches so they don't clobber our insert.
      await qc.cancelQueries({ queryKey: key })

      const tempId = `optimistic:${
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${optimisticSeq++}`
      }`

      const optimistic: Message = {
        id: tempId,
        groupId,
        senderId: currentUser?.id ?? '',
        sender: {
          id: currentUser?.id ?? '',
          name: currentUser?.name ?? '',
          avatarUrl: currentUser?.avatarUrl ?? null,
        },
        content: dto.content,
        type: dto.fileKey
          ? dto.fileMime?.startsWith('image/')
            ? MessageType.IMAGE
            : MessageType.FILE
          : MessageType.TEXT,
        replyToId: dto.replyToId ?? null,
        fileKey: dto.fileKey ?? null,
        fileName: dto.fileName ?? null,
        fileSize: dto.fileSize ?? null,
        fileMime: dto.fileMime ?? null,
        isPinned: false,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        editedAt: null,
        reactions: [],
        _count: { replies: 0 },
        pending: true,
      }

      qc.setQueryData<MessagesCache>(key, (old) => {
        if (!old || old.pages.length === 0) return old
        const pages = [...old.pages]
        const first = { ...pages[0], messages: [...pages[0].messages, optimistic] }
        pages[0] = first
        return { ...old, pages }
      })

      return { tempId }
    },

    onSuccess: (res, _dto, ctx) => {
      const real = res.data.data
      const tempId = ctx?.tempId
      qc.setQueryData<MessagesCache>(key, (old) => {
        if (!old) return old
        return {
          ...old,
          pages: old.pages.map((p) => {
            // Replace the placeholder with the real message if still present.
            if (tempId && p.messages.some((m) => m.id === tempId)) {
              return {
                ...p,
                messages: p.messages.map((m) => (m.id === tempId ? real : m)),
              }
            }
            // Socket already delivered the real message and removed the
            // placeholder → ensure we don't leave a stale optimistic copy.
            if (tempId && p.messages.some((m) => m.id === real.id)) {
              return { ...p, messages: p.messages.filter((m) => m.id !== tempId) }
            }
            return p
          }),
        }
      })
    },

    onError: (_err, _dto, ctx) => {
      const tempId = ctx?.tempId
      qc.setQueryData<MessagesCache>(key, (old) => {
        if (!old || !tempId) return old
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            messages: p.messages.map((m) =>
              m.id === tempId ? { ...m, pending: false, failed: true } : m,
            ),
          })),
        }
      })
      toast.error(getErrorMessage(_err))
    },
  })
}

let optimisticSeq = 0

export function useDeleteMessage(groupId: string) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useMutation({
    mutationFn: (messageId: string) =>
      api.delete(getUrl(activeUnit!.id, `/groups/${groupId}/messages/${messageId}`)),
  })
}

export function usePinMessage(groupId: string) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageId: string) =>
      api.patch(getUrl(activeUnit!.id, `/groups/${groupId}/messages/${messageId}/pin`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', groupId, 'pinned'] }),
  })
}

export function useToggleReaction(groupId: string) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api
        .post<{ data: MessageReactionSummary }>(
          getUrl(activeUnit!.id, `/groups/${groupId}/messages/${messageId}/reactions`),
          { emoji },
        )
        .then((r) => r.data.data),
    // Apply the returned summary immediately so the reaction shows instantly,
    // independent of the `message:reaction` socket echo (which also arrives and
    // reconciles the same state for every other member in the room).
    onSuccess: (payload) => applyReactionSummary(qc, groupId, payload, currentUserId),
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export function useBookmarks() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useInfiniteQuery<BookmarksPage>({
    queryKey: ['bookmarks', activeUnit?.id],
    queryFn: async ({ pageParam }) => {
      const url = getUrl(activeUnit!.id, '/chat/bookmarks')
      const res = await api.get<{ data: BookmarksPage }>(url, {
        params: pageParam ? { cursor: pageParam } : {},
      })
      return res.data.data
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!activeUnit,
  })
}

export function useToggleBookmark() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ messageId, isBookmarked }: { messageId: string; isBookmarked: boolean }) => {
      const url = isBookmarked
        ? getUrl(activeUnit!.id, `/chat/bookmarks/${messageId}`)
        : getUrl(activeUnit!.id, '/chat/bookmarks')
      return isBookmarked
        ? api.delete(url)
        : api.post(url, { messageId })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookmarks', activeUnit?.id] }),
  })
}

// ─── Custom emojis ────────────────────────────────────────────────────────────

export function useCustomEmojis() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useQuery<CustomEmoji[]>({
    queryKey: ['custom-emojis', activeUnit?.id],
    queryFn: async () => {
      const res = await api.get<{ data: CustomEmoji[] }>(
        getUrl(activeUnit!.id, '/chat/custom-emojis'),
      )
      return res.data.data
    },
    enabled: !!activeUnit,
    staleTime: 60_000,
  })
}

export function useCreateCustomEmoji() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ shortcode, file }: { shortcode: string; file: File }) => {
      const form = new FormData()
      form.append('shortcode', shortcode)
      form.append('file', file)
      const res = await api.post<{ data: CustomEmoji }>(
        getUrl(activeUnit!.id, '/chat/custom-emojis'),
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-emojis', activeUnit?.id] }),
  })
}

export function useDeleteCustomEmoji() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(getUrl(activeUnit!.id, `/chat/custom-emojis/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-emojis', activeUnit?.id] }),
  })
}

// ─── Chat reminders ───────────────────────────────────────────────────────────

export function useCreateReminder() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dto: { text: string; remindAt: string; groupId?: string }) => {
      const res = await api.post<{ data: ChatReminder }>(
        getUrl(activeUnit!.id, '/chat/reminders'),
        dto,
      )
      return res.data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders', activeUnit?.id] }),
  })
}

// ─── Chat search ──────────────────────────────────────────────────────────────

export interface ChatSearchParams {
  q: string
  groupId?: string
  from?: string
  to?: string
}

// ─── Threads ──────────────────────────────────────────────────────────────────

export function useThread(groupId: string | null, parentId: string | null) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()

  const query = useQuery<ThreadView>({
    queryKey: ['thread', groupId, parentId],
    queryFn: async () => {
      const res = await api.get<{ data: ThreadView }>(
        getUrl(activeUnit!.id, `/groups/${groupId}/messages/${parentId}/thread`),
      )
      return res.data.data
    },
    enabled: !!activeUnit && !!groupId && !!parentId,
  })

  // Live updates: a reply in this group with replyToId === parentId belongs here.
  useEffect(() => {
    if (!groupId || !parentId) return
    const socket = getSocket()
    function onNew(msg: Message) {
      if (msg.replyToId !== parentId) return
      qc.setQueryData<ThreadView>(['thread', groupId, parentId], (old) =>
        old ? { ...old, replies: [...old.replies, msg] } : old,
      )
      // Bump parent reply count in the timeline cache so the indicator updates.
      qc.invalidateQueries({ queryKey: ['messages', groupId] })
    }
    socket.on('message:new', onNew)
    return () => { socket.off('message:new', onNew) }
  }, [groupId, parentId, qc])

  return query
}

export function useChatSearch(params: ChatSearchParams, enabled = true) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useInfiniteQuery<ChatSearchPage>({
    queryKey: ['chat-search', activeUnit?.id, params.q, params.groupId ?? null, params.from ?? null, params.to ?? null],
    queryFn: async ({ pageParam }) => {
      const res = await api.get<{ data: ChatSearchPage }>(
        getUrl(activeUnit!.id, '/chat/search'),
        { params: { ...params, cursor: pageParam ?? undefined } },
      )
      return res.data.data
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: enabled && !!activeUnit && params.q.trim().length >= 2,
  })
}

export function useUploadFile() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post<{
        data: { key: string; fileName: string; mimeType: string; size: number; url: string }
      }>(getUrl(activeUnit!.id, '/upload'), form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data.data
    },
  })
}

export function useStartDirect() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (targetUserId: string) =>
      api.post<{ data: Group }>(getUrl(activeUnit!.id, '/groups/direct'), { targetUserId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] }),
  })
}

// ─── Presence ─────────────────────────────────────────────────────────────────

export function usePresence() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()

  const query = useQuery<string[]>({
    queryKey: ['presence', activeUnit?.id],
    queryFn: async () => {
      const res = await api.get<{ data: { onlineUserIds: string[] } }>(
        getUrl(activeUnit!.id, '/presence'),
      )
      return res.data.data.onlineUserIds
    },
    enabled: !!activeUnit,
    staleTime: 30_000,
  })

  useEffect(() => {
    const socket = getSocket()

    function onOnline({ userId }: { userId: string }) {
      qc.setQueryData<string[]>(['presence', activeUnit?.id], (old) =>
        old ? (old.includes(userId) ? old : [...old, userId]) : [userId],
      )
    }

    function onOffline({ userId }: { userId: string }) {
      qc.setQueryData<string[]>(['presence', activeUnit?.id], (old) =>
        old ? old.filter((id) => id !== userId) : [],
      )
    }

    socket.on('user:online', onOnline)
    socket.on('user:offline', onOffline)
    return () => {
      socket.off('user:online', onOnline)
      socket.off('user:offline', onOffline)
    }
  }, [activeUnit?.id, qc])

  return query
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

export function useTypingIndicator(groupId: string | null) {
  const typingRef = useRef<NodeJS.Timeout | null>(null)

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!groupId) return
      getSocket().emit('message:typing', { groupId, isTyping })
    },
    [groupId],
  )

  function onInputChange() {
    sendTyping(true)
    if (typingRef.current) clearTimeout(typingRef.current)
    typingRef.current = setTimeout(() => sendTyping(false), 2000)
  }

  useEffect(() => () => { if (typingRef.current) clearTimeout(typingRef.current) }, [])

  return { onInputChange }
}

// ─── Huddles ──────────────────────────────────────────────────────────────────

export function useActiveHuddle(groupId: string | null) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const qc = useQueryClient()

  const query = useQuery<Huddle | null>({
    queryKey: ['huddle', activeUnit?.id, groupId],
    queryFn: async () => {
      const res = await api.get<{ data: Huddle | null }>(
        getUrl(activeUnit!.id, `/groups/${groupId}/huddle`),
      )
      return res.data.data
    },
    enabled: !!activeUnit && !!groupId,
    refetchOnWindowFocus: false,
  })

  // Live updates from gateway
  useEffect(() => {
    if (!groupId) return
    const socket = getSocket()
    socket.emit('join:group', groupId)
    const refetch = () => qc.invalidateQueries({ queryKey: ['huddle', activeUnit?.id, groupId] })
    socket.on('huddle:started', refetch)
    socket.on('huddle:ended', refetch)
    socket.on('huddle:participants', refetch)
    return () => {
      socket.off('huddle:started', refetch)
      socket.off('huddle:ended', refetch)
      socket.off('huddle:participants', refetch)
    }
  }, [activeUnit?.id, groupId, qc])

  return query
}

export function useStartHuddle() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useMutation({
    mutationFn: async (groupId: string) => {
      const res = await api.post<{ data: HuddleTokenResponse }>(
        getUrl(activeUnit!.id, `/groups/${groupId}/huddle/start`),
      )
      return res.data.data
    },
  })
}

export function useJoinHuddle() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useMutation({
    mutationFn: async (huddleId: string) => {
      const res = await api.post<{ data: HuddleTokenResponse }>(
        getUrl(activeUnit!.id, `/huddles/${huddleId}/join`),
      )
      return res.data.data
    },
  })
}

export function useLeaveHuddle() {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useMutation({
    mutationFn: (huddleId: string) =>
      api.post(getUrl(activeUnit!.id, `/huddles/${huddleId}/leave`), {}),
  })
}

// ─── System events (ephemeral management notices) ──────────────────────────────

export interface GroupSystemNotice {
  id: number
  tone: 'info' | 'success' | 'warning' | 'danger'
  icon: string
  text: string
  href?: string
}

let systemNoticeSeq = 0

/**
 * Listens for ephemeral `group:system-event` notices (impediment escalated,
 * etc.) for the active group and exposes them as a short-lived list. Notices are
 * NOT persisted — they auto-expire and clear when the group changes.
 */
export function useGroupSystemEvents(groupId: string | null) {
  const [notices, setNotices] = useState<GroupSystemNotice[]>([])

  useEffect(() => {
    setNotices([])
    if (!groupId) return
    const socket = getSocket()

    function onSystemEvent(payload: Omit<GroupSystemNotice, 'id'>) {
      const id = systemNoticeSeq++
      setNotices((prev) => [...prev, { ...payload, id }])
      // Auto-expire after 12s so the thread doesn't accumulate stale banners.
      setTimeout(() => {
        setNotices((prev) => prev.filter((n) => n.id !== id))
      }, 12_000)
    }

    socket.on('group:system-event', onSystemEvent)
    return () => {
      socket.off('group:system-event', onSystemEvent)
    }
  }, [groupId])

  const dismiss = useCallback((id: number) => {
    setNotices((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return { notices, dismiss }
}
