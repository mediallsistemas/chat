'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { clsx } from 'clsx'
import { PageHeader } from '@/shared/components'
import { Button, FormModal } from '@/shared/components/ui'
import { FormField } from '@/shared/components/ui/form-field'
import {
  useDocumentFolders,
  useDocuments,
  useCreateFolder,
  useDeleteFolder,
  useUploadDocument,
  useDeleteDocument,
} from '@/features/documents/hooks/use-documents'
import type { DocumentFolder } from '@mediall/types'

const createFolderSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100, 'Máximo 100 caracteres'),
})
type CreateFolderForm = z.infer<typeof createFolderSchema>

const uploadDocSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
})
type UploadDocForm = z.infer<typeof uploadDocSchema>

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return 'ti-photo'
  if (mime.includes('pdf')) return 'ti-file-type-pdf'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'ti-file-type-xls'
  if (mime.includes('word') || mime.includes('document')) return 'ti-file-type-doc'
  if (mime.includes('video')) return 'ti-video'
  return 'ti-file'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function DocumentosPage() {
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: folders = [], isLoading: foldersLoading } = useDocumentFolders()
  const { data: documents = [], isLoading: docsLoading } = useDocuments(activeFolderId)
  const createFolder = useCreateFolder()
  const deleteFolder = useDeleteFolder()
  const uploadDoc = useUploadDocument()
  const deleteDoc = useDeleteDocument()

  const activeFolder = folders.find((f) => f.id === activeFolderId)

  const folderForm = useForm<CreateFolderForm>({
    resolver: zodResolver(createFolderSchema),
    defaultValues: { name: '' },
  })

  const uploadForm = useForm<UploadDocForm>({
    resolver: zodResolver(uploadDocSchema),
    defaultValues: { name: '' },
  })

  async function handleCreateFolder(data: CreateFolderForm) {
    await createFolder.mutateAsync({ name: data.name.trim() })
    folderForm.reset()
    setShowCreateFolder(false)
  }

  async function handleUpload(data: UploadDocForm) {
    if (!uploadFile) return
    await uploadDoc.mutateAsync({
      file: uploadFile,
      name: data.name.trim(),
      folderId: activeFolderId ?? undefined,
    })
    setUploadFile(null)
    uploadForm.reset()
    setShowUpload(false)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Documentos" subtitle="Central de documentos institucionais" />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowCreateFolder(true)}>
            <i className="ti ti-folder-plus mr-1" /> Nova pasta
          </Button>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <i className="ti ti-upload mr-1" /> Enviar arquivo
          </Button>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* Folder tree */}
        <aside className="w-56 shrink-0 bg-white rounded-xl border border-gs/60 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gs/40">
            <p className="text-xs font-semibold text-gs uppercase tracking-wide">Pastas</p>
          </div>

          <nav className="p-2 space-y-0.5">
            <button
              onClick={() => setActiveFolderId(null)}
              className={clsx(
                'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors',
                activeFolderId === null ? 'bg-gn/20 text-gd font-medium' : 'text-gs hover:bg-gs/10',
              )}
            >
              <i className="ti ti-home text-[16px]" />
              Raiz
            </button>

            {foldersLoading
              ? [1, 2, 3].map((i) => <div key={i} className="h-8 rounded-lg bg-gs/10 animate-pulse mx-1" />)
              : folders.map((folder: DocumentFolder) => (
                  <div key={folder.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => setActiveFolderId(folder.id)}
                      className={clsx(
                        'flex-1 flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors text-left',
                        activeFolderId === folder.id ? 'bg-gn/20 text-gd font-medium' : 'text-gs hover:bg-gs/10',
                      )}
                    >
                      <i className="ti ti-folder text-[16px]" />
                      <span className="truncate">{folder.name}</span>
                      <span className="text-xs text-gs ml-auto">{folder._count?.documents ?? 0}</span>
                    </button>
                    <button
                      onClick={() => deleteFolder.mutate(folder.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gs hover:text-red-500 transition-all"
                      aria-label="Excluir pasta"
                    >
                      <i className="ti ti-trash text-xs" />
                    </button>
                  </div>
                ))}
          </nav>
        </aside>

        {/* Document list */}
        <div className="flex-1 min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <i className="ti ti-folder-open text-gd text-lg" />
            <span className="text-sm font-medium text-gd">
              {activeFolder ? activeFolder.name : 'Raiz'}
            </span>
          </div>

          {docsLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-gs/10 animate-pulse" />)}
            </div>
          )}

          {!docsLoading && documents.length === 0 && (
            <div className="text-center py-16 text-gs">
              <i className="ti ti-files text-4xl block mb-3 opacity-30" />
              <p className="text-sm">Nenhum documento nesta pasta.</p>
              <p className="text-xs mt-1">Clique em &quot;Enviar arquivo&quot; para adicionar.</p>
            </div>
          )}

          {!docsLoading && documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-xl border border-gs/60 p-4 flex items-center gap-4 hover:border-gn/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-gs/10 flex items-center justify-center shrink-0">
                    <i className={`ti ${fileIcon(doc.fileMime)} text-xl text-gd`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gd truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gs mt-0.5">
                      <span>{formatSize(doc.fileSize)}</span>
                      <span>·</span>
                      <span>{doc.uploader?.name}</span>
                      <span>·</span>
                      <span>{format(new Date(doc.createdAt), "d MMM yyyy", { locale: ptBR })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.signedUrl && (
                      <a
                        href={doc.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={doc.fileName}
                        className="p-1.5 rounded-lg text-gs hover:text-gd hover:bg-gs/10 transition-colors"
                        aria-label="Baixar"
                      >
                        <i className="ti ti-download text-base" />
                      </a>
                    )}
                    <button
                      onClick={() => deleteDoc.mutate(doc.id)}
                      className="p-1.5 rounded-lg text-gs hover:text-red-500 hover:bg-red-50 transition-colors"
                      aria-label="Excluir"
                    >
                      <i className="ti ti-trash text-base" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create folder modal */}
      <FormModal
        open={showCreateFolder}
        onClose={() => { folderForm.reset(); setShowCreateFolder(false) }}
        title="Nova pasta"
        size="sm"
        onSubmit={folderForm.handleSubmit(handleCreateFolder)}
        isPending={createFolder.isPending}
        submitLabel="Criar"
      >
        <FormField label="Nome" error={folderForm.formState.errors.name} required>
          <input
            autoFocus
            {...folderForm.register('name')}
            className="input w-full"
            placeholder="Ex.: Contratos, Políticas, RH..."
          />
        </FormField>
      </FormModal>

      {/* Upload modal */}
      <FormModal
        open={showUpload}
        onClose={() => { uploadForm.reset(); setUploadFile(null); setShowUpload(false) }}
        title="Enviar documento"
        size="sm"
        onSubmit={uploadForm.handleSubmit(handleUpload)}
        isPending={uploadDoc.isPending}
        submitDisabled={!uploadFile}
        submitLabel="Enviar"
      >
        <div>
          <label className="block text-sm font-medium text-gd mb-1">Arquivo</label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) {
                setUploadFile(f)
                if (!uploadForm.getValues('name')) {
                  uploadForm.setValue('name', f.name.replace(/\.[^.]+$/, ''))
                }
              }
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gs/40 rounded-xl py-6 text-center hover:border-gn transition-colors"
          >
            {uploadFile ? (
              <div>
                <i className="ti ti-file-check text-2xl text-green-500 block mb-1" />
                <p className="text-sm font-medium text-gd">{uploadFile.name}</p>
                <p className="text-xs text-gs">{formatSize(uploadFile.size)}</p>
              </div>
            ) : (
              <div>
                <i className="ti ti-upload text-2xl text-gs block mb-1" />
                <p className="text-sm text-gs">Clique para selecionar</p>
              </div>
            )}
          </button>
        </div>
        <FormField label="Nome do documento" error={uploadForm.formState.errors.name} required>
          <input
            {...uploadForm.register('name')}
            className="input w-full"
            placeholder="Ex.: Contrato de prestação de serviços"
          />
        </FormField>
      </FormModal>
    </div>
  )
}
