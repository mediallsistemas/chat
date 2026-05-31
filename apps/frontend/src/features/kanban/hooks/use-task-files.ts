'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUploadFile } from '@/features/chat/hooks/use-chat'
import { useUnitStore } from '@/store/unit-store'
import { toast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/get-error-message'
import type { TaskFile } from '@mediall/types'

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data
}

export function useTaskFiles(taskId: string) {
  const queryClient = useQueryClient()
  const activeUnit = useUnitStore((s) => s.activeUnit)
  const unitId = activeUnit?.id ?? ''

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['task-files', unitId, taskId],
    queryFn: () =>
      api.get<{ data: TaskFile[] }>(`/units/${unitId}/tasks/${taskId}/files`).then(unwrap),
    enabled: !!unitId && !!taskId,
  })

  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile()

  async function attachUpload(file: File) {
    if (!unitId) return
    try {
      const result = await uploadFile(file)
      await api.post(`/units/${unitId}/tasks/${taskId}/files`, {
        fileKey: result.key,
        fileName: result.fileName,
        fileSize: result.size,
        fileMime: result.mimeType,
      })
      queryClient.invalidateQueries({ queryKey: ['task-files', unitId, taskId] })
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const { mutate: removeFile } = useMutation({
    mutationFn: (fileId: string) =>
      api.delete(`/units/${unitId}/tasks/${taskId}/files/${fileId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['task-files', unitId, taskId] }),
    onError: (err) => toast.error(getErrorMessage(err)),
  })

  return { files, isLoading, isUploading, attachUpload, removeFile }
}

export function useTaskSearch(unitId: string, q: string) {
  return useQuery({
    queryKey: ['tasks-search', unitId, q],
    queryFn: () =>
      api
        .get<{ data: { id: string; title: string }[] }>(
          `/units/${unitId}/tasks/search?q=${encodeURIComponent(q)}`,
        )
        .then(unwrap),
    enabled: !!unitId && q.trim().length >= 2,
    staleTime: 10_000,
  })
}
