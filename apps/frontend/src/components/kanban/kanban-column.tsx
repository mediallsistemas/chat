'use client'

import { clsx } from 'clsx'
import { Droppable } from 'react-beautiful-dnd'
import { KanbanCard } from './kanban-card'
import type { KanbanColumnItem } from '@/hooks/use-kanban'

interface Props {
  column: KanbanColumnItem
  onAddTask: (columnId: string) => void
  onOpenDetail: (taskId: string) => void
}

export function KanbanColumn({ column, onAddTask, onOpenDetail }: Props) {
  const isAtWipLimit = column.wipLimit != null && column.tasks.length >= column.wipLimit

  return (
    <div className="flex flex-col w-64 shrink-0 bg-page-bg rounded-2xl border border-gs/60 overflow-hidden">
      {/* Column header */}
      <div
        className={clsx(
          'flex items-center justify-between px-3 py-2.5 border-b border-gs/60',
          column.isDoneColumn ? 'bg-gn/20' : 'bg-white',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-gray-800 font-sora truncate">
            {column.name}
          </span>
          <span
            className={clsx(
              'text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0',
              isAtWipLimit
                ? 'bg-red-100 text-red-600'
                : 'bg-gs/60 text-gx',
            )}
            title={column.wipLimit ? `Limite: ${column.wipLimit}` : undefined}
          >
            {column.tasks.length}
            {column.wipLimit != null && `/${column.wipLimit}`}
          </span>
        </div>
        <button
          onClick={() => onAddTask(column.id)}
          className="p-1 rounded-lg text-gx hover:bg-gs/60 hover:text-gray-700 transition-colors shrink-0"
          aria-label={`Adicionar tarefa em ${column.name}`}
        >
          <i className="ti ti-plus text-sm" aria-hidden="true" />
        </button>
      </div>

      {/* Droppable cards area */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={clsx(
              'flex-1 p-2 space-y-2 min-h-[120px] transition-colors',
              snapshot.isDraggingOver && 'bg-gn/10',
            )}
          >
            {column.tasks.map((task, index) => (
              <KanbanCard
                key={task.id}
                task={task}
                index={index}
                isDoneColumn={column.isDoneColumn}
                onOpenDetail={onOpenDetail}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}
