'use client'

import { clsx } from 'clsx'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { KanbanTaskItem } from '@/features/kanban/hooks/use-kanban'

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-gray-300',
  MEDIUM: 'bg-blue-400',
  HIGH: 'bg-yellow-400',
  URGENT: 'bg-red-500',
}

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

interface Props {
  task: KanbanTaskItem
  isDoneColumn: boolean
  onOpenDetail: (taskId: string) => void
}

export function KanbanCard({ task, isDoneColumn, onOpenDetail }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const hasMeta = task._count.checklists > 0 || task._count.impediments > 0
  const isPending = task.acceptanceStatus === 'PENDING'

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onOpenDetail(task.id)}
      className={clsx(
        'bg-white rounded-xl border p-3 text-sm select-none',
        'transition-shadow cursor-grab active:cursor-grabbing',
        isDragging
          ? 'shadow-lg border-gd/40 rotate-1 opacity-80'
          : 'border-gs/60 shadow-sm hover:shadow-md hover:border-gs',
        task.isBlocked && 'border-l-4 border-l-red-400',
        isDoneColumn && 'opacity-60',
      )}
    >
      {/* Priority + acceptance */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className={clsx('w-2 h-2 rounded-full shrink-0', PRIORITY_DOT[task.priority])}
            title={PRIORITY_LABEL[task.priority]}
          />
          {isPending && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 font-medium">
              Pendente
            </span>
          )}
        </div>
        {task.isBlocked && (
          <span title="Bloqueada">
            <i className="ti ti-lock text-red-400 text-xs" aria-hidden="true" />
          </span>
        )}
      </div>

      {/* Title */}
      <p className="font-medium text-gray-800 leading-snug line-clamp-2">{task.title}</p>

      {/* Footer meta */}
      {hasMeta && (
        <div className="flex items-center gap-3 mt-2 text-xs text-gx">
          {task._count.checklists > 0 && (
            <span className="flex items-center gap-1">
              <i className="ti ti-checklist text-xs" aria-hidden="true" />
              {task._count.checklists}
            </span>
          )}
          {task._count.impediments > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <i className="ti ti-alert-triangle text-xs" aria-hidden="true" />
              {task._count.impediments}
            </span>
          )}
        </div>
      )}

      {/* Due date */}
      {task.dueDate && (
        <p className="text-[10px] text-gx mt-1">
          <i className="ti ti-calendar text-[10px] mr-0.5" aria-hidden="true" />
          {new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </p>
      )}
    </div>
  )
}
