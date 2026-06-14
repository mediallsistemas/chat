'use client'

import { useCallback, useState } from 'react'
import { toast } from '@/shared/hooks/use-toast'
import { getErrorMessage } from '@/shared/lib/get-error-message'
import { useUploadFile, useSendMessage } from './use-chat'

/** Mirror of the backend upload limit (FilesController, 20 MB). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024

/**
 * Centralises the "attach a file" flow shared by the paperclip button,
 * drag-and-drop and clipboard paste: validate size on the client, upload to
 * MinIO via the existing `/upload` endpoint, then send a message referencing the
 * uploaded key. Multiple files are uploaded sequentially. All errors surface as
 * a toast; the backend remains the source of truth for type/size.
 */
export function useFileAttachment(groupId: string | null) {
  const { mutateAsync: uploadFile } = useUploadFile()
  const { mutate: sendMsg } = useSendMessage(groupId ?? '')
  const [uploading, setUploading] = useState(false)

  const sendFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`"${file.name}" excede o limite de 20 MB.`)
        return
      }
      try {
        const uploaded = await uploadFile(file)
        sendMsg({
          content: '',
          fileKey: uploaded.key,
          fileName: uploaded.fileName,
          fileSize: uploaded.size,
          fileMime: uploaded.mimeType,
        })
      } catch (err) {
        toast.error(getErrorMessage(err))
      }
    },
    [uploadFile, sendMsg],
  )

  const sendFiles = useCallback(
    async (files: Iterable<File>) => {
      if (!groupId) return
      const list = Array.from(files)
      if (list.length === 0) return
      setUploading(true)
      try {
        // Sequential: keeps order and avoids hammering the upload endpoint.
        for (const file of list) {
          await sendFile(file)
        }
      } finally {
        setUploading(false)
      }
    },
    [groupId, sendFile],
  )

  return { sendFiles, uploading }
}
