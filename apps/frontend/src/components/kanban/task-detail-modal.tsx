'use client'

import { useState, useRef, KeyboardEvent } from 'react'
import { clsx } from 'clsx'
import { Modal } from '@/components/ui'
import {
  useTaskDetail,
  useAddChecklistItem,
  useToggleChecklistItem,
  useDeleteChecklistItem,
  useAddDependency,
  useRemoveDependency,
  useKanbanBoard,
} from '@/hooks/use-kanban'
import { useTaskFiles } from '@/hooks/use-task-files'
import type { TaskChecklist, TaskDependency, TaskFile } from '@mediall/types'

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente',
}
const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-gray-300', MEDIUM: 'bg-blue-400', HIGH: 'bg-yellow-400', URGENT: 'bg-red-500',
}

interface Props {
  open: boolean
  onClose: () => void
  taskId: string
  unitId: string
  boardId: string
}

function ChecklistItem({
  item,
  onToggle,
  onDelete,
}: {
  item: TaskChecklist
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2 group py-1">
      <button
        onClick={onToggle}
        className={clsx(
          'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
          item.isDone ? 'bg-gd border-gd text-white' : 'border-gs hover:border-gd',
        )}
        aria-label={item.isDone ? 'Desmarcar' : 'Marcar como feito'}
      >
        {item.isDone && <i className="ti ti-check text-[10px]" aria-hidden="true" />}
      </button>
      <span className={clsx('text-sm flex-1', item.isDone && 'line-through text-gx')}>
        {item.description}
      </span>
      <button
        onClick={onDelete}
        className="p-0.5 rounded text-gx hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Excluir item"
      >
        <i className="ti ti-x text-xs" aria-hidden="true" />
      </button>
    </div>
  )
}

function DependencyItem({
  dep,
  onRemove,
}: {
  dep: TaskDependency
  onRemove: () => void
}) {
  const isDone = !dep.dependsOn.columnId // columnId present means not done — we use a heuristic below
  return (
    <div className="flex items-center gap-2 group py-1">
      <i
        className={clsx(
          'ti text-sm shrink-0',
          isDone ? 'ti-circle-check text-green-500' : 'ti-circle text-gx',
        )}
        aria-hidden="true"
      />
      <span className="text-sm flex-1 truncate text-gray-700">{dep.dependsOn.title}</span>
      <button
        onClick={onRemove}
        className="p-0.5 rounded text-gx hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remover dependência"
      >
        <i className="ti ti-x text-xs" aria-hidden="true" />
      </button>
    </div>
  )
}

function FileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileAttachmentItem({ file, onRemove }: { file: TaskFile; onRemove: () => void }) {
  const isImage = file.fileMime.startsWith('image/')
  return (
    <div className="flex items-center gap-3 py-2 group">
      <div className="w-8 h-8 rounded-lg bg-gs/40 flex items-center justify-center shrink-0">
        <i className={clsx('ti text-sm text-gx', isImage ? 'ti-photo' : 'ti-file')} aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gd hover:underline truncate block"
        >
          {file.fileName}
        </a>
        <span className="text-[11px] text-gx">{FileSizeLabel(file.fileSize)}</span>
      </div>
      <button
        onClick={onRemove}
        className="p-0.5 rounded text-gx hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remover arquivo"
      >
        <i className="ti ti-x text-xs" aria-hidden="true" />
      </button>
    </div>
  )
}

export function TaskDetailModal({ open, onClose, taskId, unitId, boardId }: Props) {
  const { data: task, isLoading } = useTaskDetail(open ? unitId : undefined, open ? taskId : undefined)
  const { data: board } = useKanbanBoard(open ? unitId : undefined, open ? boardId : undefined)

  const { mutate: addItem, isPending: adding } = useAddChecklistItem(unitId)
  const { mutate: toggleItem } = useToggleChecklistItem(unitId)
  const { mutate: deleteItem } = useDeleteChecklistItem(unitId)
  const { mutate: addDep, isPending: addingDep, error: depError } = useAddDependency(unitId)
  const { mutate: removeDep } = useRemoveDependency(unitId)
  const { files, isUploading, attachUpload, removeFile } = useTaskFiles(open ? taskId : '')

  const [newItemText, setNewItemText] = useState('')
  const [depSearch, setDepSearch] = useState('')
  const [showDepPicker, setShowDepPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const checklists = task?.checklists ?? []
  const dependencies = task?.dependencies ?? []
  const doneCount = checklists.filter((c) => c.isDone).length
  const totalCount = checklists.length
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  // All tasks in the board except current + already-added deps
  const existingDepIds = new Set(dependencies.map((d) => d.dependsOnId))
  const allBoardTasks = board?.columns.flatMap((c) => c.tasks) ?? []
  const availableTasks = allBoardTasks.filter(
    (t) => t.id !== taskId && !existingDepIds.has(t.id),
  )
  const filteredAvailable = depSearch
    ? availableTasks.filter((t) => t.title.toLowerCase().includes(depSearch.toLowerCase()))
    : availableTasks

  function submitNewItem() {
    const desc = newItemText.trim()
    if (!desc) return
    addItem({ taskId, description: desc }, { onSuccess: () => setNewItemText('') })
  }

  function onChecklistKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); submitNewItem() }
    if (e.key === 'Escape') setNewItemText('')
  }

  function pickDependency(dependsOnId: string) {
    addDep(
      { taskId, dependsOnId },
      {
        onSuccess: () => {
          setDepSearch('')
          setShowDepPicker(false)
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Detalhes da tarefa" size="md">
      {isLoading ? (
        <div className="space-y-3 py-4">
          <div className="h-5 bg-gs/30 rounded animate-pulse" />
          <div className="h-5 bg-gs/30 rounded animate-pulse w-3/4" />
        </div>
      ) : task ? (
        <div className="space-y-5">
          {/* Title + meta */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-2">{task.title}</h3>
            <div className="flex items-center gap-3 text-xs text-gx flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className={clsx('w-2 h-2 rounded-full', PRIORITY_DOT[task.priority])} />
                {PRIORITY_LABEL[task.priority]}
              </span>
              {task.dueDate && (
                <span className="flex items-center gap-1">
                  <i className="ti ti-calendar text-xs" aria-hidden="true" />
                  {new Date(task.dueDate).toLocaleDateString('pt-BR')}
                </span>
              )}
              {task.isBlocked && (
                <span className="flex items-center gap-1 text-red-500 font-medium">
                  <i className="ti ti-lock text-xs" aria-hidden="true" />
                  Bloqueada
                </span>
              )}
            </div>
            {task.description && (
              <p className="mt-2 text-sm text-gray-600">{task.description}</p>
            )}
          </div>

          {/* Dependencies section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <i className="ti ti-git-branch text-sm" aria-hidden="true" />
                Dependências
                {dependencies.length > 0 && (
                  <span className="text-gx font-normal normal-case">{dependencies.length}</span>
                )}
              </h4>
              {availableTasks.length > 0 && (
                <button
                  onClick={() => setShowDepPicker((v) => !v)}
                  className="text-[11px] text-gd hover:underline flex items-center gap-0.5"
                >
                  <i className="ti ti-plus text-xs" aria-hidden="true" />
                  Adicionar
                </button>
              )}
            </div>

            {/* Dependency picker */}
            {showDepPicker && (
              <div className="mb-2 border border-gs rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="px-3 py-2 border-b border-gs/60">
                  <input
                    type="text"
                    value={depSearch}
                    onChange={(e) => setDepSearch(e.target.value)}
                    placeholder="Buscar tarefa..."
                    className="w-full text-sm focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {filteredAvailable.length === 0 ? (
                    <p className="text-xs text-gx px-3 py-3">Nenhuma tarefa disponível</p>
                  ) : (
                    filteredAvailable.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => pickDependency(t.id)}
                        disabled={addingDep}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-page-bg transition-colors flex items-center gap-2"
                      >
                        <i className="ti ti-circle text-gx text-xs shrink-0" aria-hidden="true" />
                        <span className="truncate">{t.title}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {depError && (
              <p className="text-xs text-red-500 mb-2">
                {(depError as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao adicionar dependência'}
              </p>
            )}

            {dependencies.length === 0 ? (
              <p className="text-xs text-gx">Sem dependências</p>
            ) : (
              <div className="space-y-0.5">
                {dependencies.map((dep) => (
                  <DependencyItem
                    key={dep.id}
                    dep={dep}
                    onRemove={() => removeDep({ taskId, dependsOnId: dep.dependsOnId })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Checklist section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <i className="ti ti-checklist text-sm" aria-hidden="true" />
                Checklist
                {totalCount > 0 && (
                  <span className="text-gx font-normal normal-case">
                    {doneCount}/{totalCount}
                  </span>
                )}
              </h4>
            </div>

            {totalCount > 0 && (
              <div className="h-1.5 bg-gs rounded-full overflow-hidden mb-3">
                <div
                  className={clsx(
                    'h-full rounded-full transition-all duration-300',
                    progress === 100 ? 'bg-green-500' : 'bg-gd',
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <div className="space-y-0.5">
              {checklists.map((item) => (
                <ChecklistItem
                  key={item.id}
                  item={item}
                  onToggle={() => toggleItem({ taskId, checklistId: item.id })}
                  onDelete={() => deleteItem({ taskId, checklistId: item.id })}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                ref={inputRef}
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={onChecklistKeyDown}
                placeholder="Adicionar item..."
                className="flex-1 text-sm px-3 py-1.5 border border-gs rounded-xl focus:outline-none focus:border-gd focus:ring-1 focus:ring-gd/20 bg-page-bg"
                disabled={adding}
              />
              <button
                onClick={submitNewItem}
                disabled={!newItemText.trim() || adding}
                className="p-1.5 rounded-lg bg-gd text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                aria-label="Adicionar item"
              >
                <i className="ti ti-plus text-sm" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Files section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
                <i className="ti ti-paperclip text-sm" aria-hidden="true" />
                Arquivos
                {files.length > 0 && (
                  <span className="text-gx font-normal normal-case">{files.length}</span>
                )}
              </h4>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-[11px] text-gd hover:underline flex items-center gap-0.5 disabled:opacity-50"
              >
                <i className="ti ti-upload text-xs" aria-hidden="true" />
                {isUploading ? 'Enviando…' : 'Anexar'}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) attachUpload(file)
                e.target.value = ''
              }}
            />

            {files.length === 0 ? (
              <p className="text-xs text-gx">Nenhum arquivo anexado</p>
            ) : (
              <div className="space-y-0.5 divide-y divide-gs/40">
                {files.map((f) => (
                  <FileAttachmentItem
                    key={f.id}
                    file={f}
                    onRemove={() => removeFile(f.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
