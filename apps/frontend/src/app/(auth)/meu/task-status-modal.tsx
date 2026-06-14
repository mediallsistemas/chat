'use client'

import { Modal, Button } from '@/shared/components/ui'
import { useBoardColumns, useMoveMyTask } from '@/features/me/hooks/use-me'
import { clsx } from 'clsx'
import type { MyTask } from '@mediall/types'

interface Props {
  task: MyTask | null
  onClose: () => void
}

/**
 * Read-only view of a task with one editable affordance: pick a column
 * (= change status). All other fields are display-only. Used by the
 * colaborador home page.
 */
export function TaskStatusModal({ task, onClose }: Props) {
  const { data: columns = [], isLoading } = useBoardColumns(task?.boardId ?? null)
  const { mutate: moveTask, isPending } = useMoveMyTask()

  if (!task) return null

  function move(columnId: string) {
    if (!task) return
    if (columnId === task.columnId) return
    moveTask(
      { taskId: task.id, columnId },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <Modal open={!!task} onClose={onClose} title="Detalhe da tarefa" size="sm">
      <div className="space-y-4">
        <div>
          <p className="text-base font-semibold text-gd">{task.title}</p>
          <p className="text-[11px] text-gx mt-0.5">{task.board.name}</p>
        </div>

        {task.description && (
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gx mb-1">Descrição</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          {task.dueDate && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gx mb-0.5">Prazo</p>
              <p className="text-gray-700">
                {new Date(task.dueDate).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-gx mb-0.5">Prioridade</p>
            <p className="text-gray-700 capitalize">{task.priority.toLowerCase()}</p>
          </div>
          {task.isBlocked && (
            <div className="col-span-2">
              <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                <i className="ti ti-alert-triangle" aria-hidden="true" />
                Bloqueada
              </span>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-gs/40">
          <p className="text-[11px] uppercase tracking-wider text-gx mb-2">Mover para</p>
          {isLoading ? (
            <p className="text-xs text-gx">Carregando colunas…</p>
          ) : columns.length === 0 ? (
            <p className="text-xs text-gx">Nenhuma coluna disponível.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {columns.map((c) => {
                const active = c.id === task.columnId
                return (
                  <button
                    key={c.id}
                    onClick={() => move(c.id)}
                    disabled={isPending || active}
                    className={clsx(
                      'text-xs px-3 py-1.5 rounded-lg border transition-colors',
                      active
                        ? 'border-gd bg-gd text-white cursor-default'
                        : 'border-gs/60 text-gd hover:bg-page-bg disabled:opacity-50',
                    )}
                  >
                    {c.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gs/40">
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  )
}
