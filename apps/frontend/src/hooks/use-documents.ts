'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUnitStore } from '@/store/unit-store'
import { toast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/get-error-message'
import type { Document, DocumentFolder } from '@mediall/types'

function base(unitId: string) {
  return `/units/${unitId}`
}

export function useDocumentFolders() {
  const { activeUnit } = useUnitStore()
  return useQuery({
    queryKey: ['document-folders', activeUnit?.id],
    queryFn: async () => {
      const res = await api.get<{ data: DocumentFolder[] }>(`${base(activeUnit!.id)}/document-folders`)
      return res.data.data
    },
    enabled: !!activeUnit?.id,
  })
}

export function useDocuments(folderId?: string | null) {
  const { activeUnit } = useUnitStore()
  const params = folderId ? `?folderId=${folderId}` : ''
  return useQuery({
    queryKey: ['documents', activeUnit?.id, folderId ?? 'root'],
    queryFn: async () => {
      const res = await api.get<{ data: Document[] }>(`${base(activeUnit!.id)}/documents${params}`)
      return res.data.data
    },
    enabled: !!activeUnit?.id,
  })
}

export function useCreateFolder() {
  const { activeUnit } = useUnitStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; parentId?: string }) => {
      const res = await api.post(`${base(activeUnit!.id)}/document-folders`, data)
      return res.data.data as DocumentFolder
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-folders', activeUnit?.id] })
      toast.success('Pasta criada')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useDeleteFolder() {
  const { activeUnit } = useUnitStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (folderId: string) => {
      await api.delete(`${base(activeUnit!.id)}/document-folders/${folderId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-folders', activeUnit?.id] })
      toast.success('Pasta excluída')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useUploadDocument() {
  const { activeUnit } = useUnitStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      file,
      name,
      description,
      folderId,
      onProgress,
    }: {
      file: File
      name: string
      description?: string
      folderId?: string
      onProgress?: (percent: number) => void
    }) => {
      const form = new FormData()
      form.append('file', file)
      form.append('name', name)
      if (description) form.append('description', description)
      if (folderId) form.append('folderId', folderId)
      const res = await api.post(`${base(activeUnit!.id)}/documents/upload`, form, {
        onUploadProgress: (e) => {
          if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      return res.data.data as Document
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['documents', activeUnit?.id, vars.folderId ?? 'root'] })
      toast.success('Arquivo enviado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useDeleteDocument() {
  const { activeUnit } = useUnitStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) => {
      await api.delete(`${base(activeUnit!.id)}/documents/${documentId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', activeUnit?.id] })
      toast.success('Arquivo excluído')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
