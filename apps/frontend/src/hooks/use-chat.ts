'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { useUnitStore } from '@/store/unit-store'
import type {
  Group,
  Message,
  GroupType,
  MessageReactionSummary,
  BookmarksPage,
  CustomEmoji,
  ChatReminder,
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
      parentId?: string
      onlyAdminsPost?: boolean
      archiveAt?: string
    }) => api.post(getUrl(activeUnit!.id, '/groups'), dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups', activeUnit?.id] }),
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

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface MessagesPage {
  messages: Message[]
  nextCursor: string | null
}

export function useMessages(groupId: string | null) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
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
      qc.setQueryData<{ pages: MessagesPage[]; pageParams: unknown[] }>(
        ['messages', groupId],
        (old) => {
          if (!old) return old
          const pages = [...old.pages]
          const last = { ...pages[pages.length - 1] }
          last.messages = [...last.messages, msg]
          pages[pages.length - 1] = last
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
                      reactions: payload.reactions.flatMap((r) =>
                        Array.from({ length: r.count }, (_, i) => ({
                          emoji: r.emoji,
                          userId: i === 0 ? payload.myReactions.includes(r.emoji) ? '' : 'other' : 'other',
                        })),
                      ),
                    }
                  : m,
              ),
            })),
          }
        },
      )
      // Store per-message reaction summary for accurate display
      qc.setQueryData(['reactions', payload.messageId], payload)
    }

    socket.on('message:new', onNew)
    socket.on('message:edited', onEdited)
    socket.on('message:deleted', onDeleted)
    socket.on('message:reaction', onReaction)

    return () => {
      socket.emit('leave:group', groupId)
      socket.off('message:new', onNew)
      socket.off('message:edited', onEdited)
      socket.off('message:deleted', onDeleted)
      socket.off('message:reaction', onReaction)
    }
  }, [groupId, qc])

  return query
}

export function useSendMessage(groupId: string) {
  const activeUnit = useUnitStore((s) => s.activeUnit)
  return useMutation({
    mutationFn: (dto: {
      content: string
      replyToId?: string
      fileKey?: string
      fileName?: string
      fileSize?: number
      fileMime?: string
    }) => api.post(getUrl(activeUnit!.id, `/groups/${groupId}/messages`), dto),
  })
}

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
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.post(getUrl(activeUnit!.id, `/groups/${groupId}/messages/${messageId}/reactions`), { emoji }),
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
