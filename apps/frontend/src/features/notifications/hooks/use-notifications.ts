'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import type { Notification } from '@mediall/types'

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data
}

export function useNotifications() {
  const queryClient = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ data: Notification[] }>('/notifications').then(unwrap),
    refetchInterval: 30_000,
  })

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () =>
      api.get<{ data: number }>('/notifications/unread-count').then(unwrap),
    refetchInterval: 15_000,
  })

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const { mutate: markAllRead } = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return { notifications, unreadCount, isLoading, markRead, markAllRead }
}
