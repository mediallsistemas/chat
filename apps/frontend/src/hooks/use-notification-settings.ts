'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/get-error-message'
import type { NotificationSetting } from '@mediall/types'

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data
}

export function useNotificationSettings() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () =>
      api.get<{ data: NotificationSetting }>('/notifications/settings').then(unwrap),
  })

  const { mutate: updateSettings, isPending: isSaving } = useMutation({
    mutationFn: (data: Partial<NotificationSetting>) =>
      api.patch('/notifications/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] })
      toast.success('Preferências de notificação salvas.')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  const { data: mutedGroups = [] } = useQuery({
    queryKey: ['notification-settings', 'muted-groups'],
    queryFn: () =>
      api.get<{ data: string[] }>('/notifications/settings/muted-groups').then(unwrap),
  })

  const { mutate: muteGroup } = useMutation({
    mutationFn: (groupId: string) =>
      api.post(`/notifications/settings/muted-groups/${groupId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notification-settings', 'muted-groups'] }),
  })

  const { mutate: unmuteGroup } = useMutation({
    mutationFn: (groupId: string) =>
      api.delete(`/notifications/settings/muted-groups/${groupId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['notification-settings', 'muted-groups'] }),
  })

  return { settings, isLoading, isSaving, updateSettings, mutedGroups, muteGroup, unmuteGroup }
}
