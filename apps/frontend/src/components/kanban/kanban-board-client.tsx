'use client'

import { useState, useCallback } from 'react'
import { DragDropContext, type DropResult } from 'react-beautiful-dnd'
import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { KanbanColumn } from './kanban-column'
import { CreateTaskModal } from './create-task-modal'
import { TaskDetailModal } from './task-detail-modal'
import { KanbanListView } from './kanban-list-view'
import { KanbanCalendarView } from './kanban-calendar-view'
import { KanbanGanttView } from './kanban-gantt-view'
import { useKanbanBoard, useMoveTask, type KanbanBoardData, type KanbanColumnItem } from '@/hooks/use-kanban'
import { KanbanBoardSkeleton } from './kanban-board-skeleton'
import { useUnitStore } from '@/store/unit-store'

type ViewMode = 'board' | 'list' | 'calendar' | 'gantt'

const VIEW_ICONS: Record<ViewMode, string> = {
  board: 'ti-layout-kanban',
  list: 'ti-list',
  calendar: 'ti-calendar',
  gantt: 'ti-timeline',
}
const VIEW_LABELS: Record<ViewMode, string> = {
  board: 'Board',
  list: 'Lista',
  calendar: 'Calendário',
  gantt: 'Gantt',
}

interface Props {
  boardId: string
  boardName?: string
}

export function KanbanBoardClient({ boardId, boardName }: Props) {
  const { activeUnit } = useUnitStore()
  const unitId = activeUnit?.id ?? ''

  const { data: board, isLoading } = useKanbanBoard(unitId, boardId)
  const { mutate: moveTask } = useMoveTask(unitId)
  const qc = useQueryClient()

  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [addTaskColumnId, setAddTaskColumnId] = useState<string | null>(null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result
      if (!destination) return
      if (destination.droppableId === source.droppableId && destination.index === source.index) return

      qc.setQueryData<KanbanBoardData>(['kanban', unitId, boardId], (old) => {
        if (!old) return old
        const next: KanbanBoardData = {
          ...old,
          columns: old.columns.map((col): KanbanColumnItem => {
            if (col.id === source.droppableId) {
              const tasks = [...col.tasks]
              tasks.splice(source.index, 1)
              return { ...col, tasks }
            }
            if (col.id === destination.droppableId) {
              const srcCol = old.columns.find((c) => c.id === source.droppableId)!
              const task = srcCol.tasks[source.index]
              const tasks = [...col.tasks]
              tasks.splice(destination.index, 0, task)
              return { ...col, tasks }
            }
            return col
          }),
        }
        return next
      })

      moveTask(
        { taskId: draggableId, dto: { columnId: destination.droppableId, position: destination.index } },
        { onError: () => qc.invalidateQueries({ queryKey: ['kanban', unitId, boardId] }) },
      )
    },
    [boardId, moveTask, qc, unitId],
  )

  if (isLoading) return <KanbanBoardSkeleton />
  if (!board) return null

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Board header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800 font-sora">
            {boardName ?? board.name}
          </h3>
          <span className="text-xs text-gx">
            {board.columns.reduce((acc, c) => acc + c.tasks.length, 0)} tarefas
          </span>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-page-bg rounded-xl p-1">
          {(['board', 'list', 'calendar', 'gantt'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                viewMode === mode
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gx hover:text-gray-700',
              )}
              aria-label={VIEW_LABELS[mode]}
              title={VIEW_LABELS[mode]}
            >
              <i className={clsx('ti text-sm', VIEW_ICONS[mode])} aria-hidden="true" />
              <span className="hidden sm:inline">{VIEW_LABELS[mode]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* View content */}
      {viewMode === 'board' && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {board.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                onAddTask={(colId) => setAddTaskColumnId(colId)}
                onOpenDetail={(taskId) => setDetailTaskId(taskId)}
              />
            ))}
          </div>
        </DragDropContext>
      )}

      {viewMode === 'list' && (
        <KanbanListView board={board} onOpenDetail={(taskId) => setDetailTaskId(taskId)} />
      )}

      {viewMode === 'calendar' && (
        <KanbanCalendarView board={board} onOpenDetail={(taskId) => setDetailTaskId(taskId)} />
      )}

      {viewMode === 'gantt' && (
        <KanbanGanttView board={board} onOpenDetail={(taskId) => setDetailTaskId(taskId)} />
      )}

      {/* Add task modal */}
      {addTaskColumnId && (
        <CreateTaskModal
          open
          onClose={() => setAddTaskColumnId(null)}
          unitId={unitId}
          boardId={board.id}
          columnId={addTaskColumnId}
        />
      )}

      {/* Task detail modal */}
      {detailTaskId && (
        <TaskDetailModal
          open
          onClose={() => setDetailTaskId(null)}
          taskId={detailTaskId}
          unitId={unitId}
          boardId={board.id}
        />
      )}
    </div>
  )
}
