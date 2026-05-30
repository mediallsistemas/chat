'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useQueryClient } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { KanbanColumn } from './kanban-column'
import { CreateTaskModal } from './create-task-modal'
import { TaskDetailModal } from './task-detail-modal'
import { KanbanListView } from './kanban-list-view'
import { KanbanCalendarView } from './kanban-calendar-view'
import { KanbanGanttView } from './kanban-gantt-view'
import { useKanbanBoard, useMoveTask, type KanbanBoardData, type KanbanColumnItem } from '@/features/kanban/hooks/use-kanban'
import { KanbanBoardSkeleton } from './kanban-board-skeleton'
import { useUnitStore } from '@/shared/store/unit-store'

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const findColumnByTaskId = useCallback(
    (taskId: string, data: KanbanBoardData) =>
      data.columns.find((col) => col.tasks.some((t) => t.id === taskId)),
    [],
  )

  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over || !board) return

      const activeId = String(active.id)
      const overId = String(over.id)
      if (activeId === overId) return

      const activeCol = findColumnByTaskId(activeId, board)
      // overId can be a column id or a task id
      const overCol =
        board.columns.find((c) => c.id === overId) ?? findColumnByTaskId(overId, board)

      if (!activeCol || !overCol || activeCol.id === overCol.id) return

      qc.setQueryData<KanbanBoardData>(['kanban', unitId, boardId], (old) => {
        if (!old) return old
        const task = activeCol.tasks.find((t) => t.id === activeId)!
        return {
          ...old,
          columns: old.columns.map((col): KanbanColumnItem => {
            if (col.id === activeCol.id) return { ...col, tasks: col.tasks.filter((t) => t.id !== activeId) }
            if (col.id === overCol.id) return { ...col, tasks: [...col.tasks, task] }
            return col
          }),
        }
      })
    },
    [board, boardId, findColumnByTaskId, qc, unitId],
  )

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || !board) return

      const activeId = String(active.id)
      const overId = String(over.id)

      const activeCol = findColumnByTaskId(activeId, board)
      const overCol =
        board.columns.find((c) => c.id === overId) ?? findColumnByTaskId(overId, board)

      if (!activeCol || !overCol) return

      const destColId = overCol.id
      const destIndex = overCol.tasks.findIndex((t) => t.id === overId)
      const position = destIndex === -1 ? overCol.tasks.length : destIndex

      // Optimistic update: reorder within column
      if (activeCol.id === overCol.id && activeId !== overId) {
        qc.setQueryData<KanbanBoardData>(['kanban', unitId, boardId], (old) => {
          if (!old) return old
          return {
            ...old,
            columns: old.columns.map((col): KanbanColumnItem => {
              if (col.id !== activeCol.id) return col
              const tasks = [...col.tasks]
              const fromIdx = tasks.findIndex((t) => t.id === activeId)
              const toIdx = tasks.findIndex((t) => t.id === overId)
              const [moved] = tasks.splice(fromIdx, 1)
              tasks.splice(toIdx, 0, moved)
              return { ...col, tasks }
            }),
          }
        })
      }

      moveTask(
        { taskId: activeId, dto: { columnId: destColId, position } },
        { onError: () => qc.invalidateQueries({ queryKey: ['kanban', unitId, boardId] }) },
      )
    },
    [board, boardId, findColumnByTaskId, moveTask, qc, unitId],
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
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
        </DndContext>
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

      {addTaskColumnId && (
        <CreateTaskModal
          open
          onClose={() => setAddTaskColumnId(null)}
          unitId={unitId}
          boardId={board.id}
          columnId={addTaskColumnId}
        />
      )}

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
