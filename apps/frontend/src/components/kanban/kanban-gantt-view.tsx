'use client'

import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { addDays, startOfDay, differenceInDays, format, isToday, isBefore, isAfter } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { KanbanBoardData } from '@/hooks/use-kanban'

const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'bg-gray-300',
  MEDIUM: 'bg-blue-400',
  HIGH: 'bg-yellow-400',
  URGENT: 'bg-red-500',
}

const PRIORITY_BAR: Record<string, string> = {
  LOW: 'bg-gray-300 hover:bg-gray-400',
  MEDIUM: 'bg-blue-400 hover:bg-blue-500',
  HIGH: 'bg-amber-400 hover:bg-amber-500',
  URGENT: 'bg-red-500 hover:bg-red-600',
}

interface GanttTask {
  id: string
  title: string
  priority: string
  startDate: string | null
  dueDate: string | null
  columnName: string
  isBlocked: boolean
  responsibleUserId: string
}

interface Props {
  board: KanbanBoardData
  onOpenDetail: (taskId: string) => void
}

const DAY_WIDTH = 32 // px per day
const VISIBLE_DAYS = 60

export function KanbanGanttView({ board, onOpenDetail }: Props) {
  const [viewStart] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7) // start 7 days before today
    return startOfDay(d)
  })

  const tasks = useMemo<GanttTask[]>(() =>
    board.columns.flatMap((col) =>
      col.tasks
        .filter((t) => t.startDate || t.dueDate)
        .map((t) => ({
          id: t.id,
          title: t.title,
          priority: t.priority,
          startDate: t.startDate,
          dueDate: t.dueDate,
          columnName: col.name,
          isBlocked: t.isBlocked,
          responsibleUserId: t.responsibleUserId,
        })),
    ),
  [board])

  const allTasks = board.columns.flatMap((col) => col.tasks)
  const tasksWithoutDates = allTasks.filter((t) => !t.startDate && !t.dueDate)

  const totalWidth = VISIBLE_DAYS * DAY_WIDTH
  const todayOffset = differenceInDays(startOfDay(new Date()), viewStart)

  // Build day headers
  const days = Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(viewStart, i))

  // Group days into weeks for the header
  const weekGroups: Array<{ label: string; days: Date[] }> = []
  let currentWeek: Date[] = []
  days.forEach((d) => {
    currentWeek.push(d)
    if (d.getDay() === 0 || d === days[days.length - 1]) {
      weekGroups.push({
        label: format(currentWeek[0], "'Sem' w", { locale: ptBR }),
        days: [...currentWeek],
      })
      currentWeek = []
    }
  })

  function getBarStyle(task: GanttTask) {
    const start = task.startDate
      ? Math.max(differenceInDays(startOfDay(new Date(task.startDate)), viewStart), 0)
      : (task.dueDate ? Math.max(differenceInDays(startOfDay(new Date(task.dueDate)), viewStart) - 2, 0) : 0)

    const end = task.dueDate
      ? differenceInDays(startOfDay(new Date(task.dueDate)), viewStart) + 1
      : (task.startDate ? Math.min(differenceInDays(startOfDay(new Date(task.startDate)), viewStart) + 3, VISIBLE_DAYS) : 0)

    const clampedStart = Math.max(start, 0)
    const clampedEnd = Math.min(end, VISIBLE_DAYS)
    const width = Math.max(clampedEnd - clampedStart, 1) * DAY_WIDTH

    const isOverdue = task.dueDate
      ? isBefore(new Date(task.dueDate), new Date()) && !board.columns.find((c) => c.isDoneColumn)?.tasks.some((t) => t.id === task.id)
      : false

    return { left: clampedStart * DAY_WIDTH, width, isOverdue }
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <i className="ti ti-timeline text-4xl text-gx" aria-hidden="true" />
        <p className="text-sm text-gx font-medium">Nenhuma tarefa com datas definidas</p>
        <p className="text-xs text-gx">Adicione datas de início ou prazo às tarefas para vê-las no Gantt</p>
        {tasksWithoutDates.length > 0 && (
          <p className="text-xs text-gx mt-1">
            {tasksWithoutDates.length} tarefa{tasksWithoutDates.length > 1 ? 's' : ''} sem data
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="overflow-auto rounded-xl border border-gs/60 bg-white">
      <div style={{ minWidth: totalWidth + 200 }}>
        {/* Header: day labels */}
        <div className="flex border-b border-gs/60 bg-page-bg sticky top-0 z-10">
          {/* Row label column */}
          <div className="w-[200px] shrink-0 px-3 py-2 text-xs font-semibold text-gx border-r border-gs/60">
            Tarefa
          </div>
          {/* Day cells */}
          <div className="flex" style={{ width: totalWidth }}>
            {days.map((d, i) => (
              <div
                key={i}
                style={{ width: DAY_WIDTH }}
                className={clsx(
                  'shrink-0 text-center text-[10px] py-1 border-r border-gs/30',
                  isToday(d) && 'bg-gd/10 text-gd font-bold',
                  d.getDay() === 0 && 'bg-red-50/40',
                  d.getDay() === 6 && 'bg-gray-50/40',
                )}
              >
                <div className="text-gx leading-none">{format(d, 'EEE', { locale: ptBR }).slice(0, 3)}</div>
                <div className={clsx('font-semibold leading-tight', isToday(d) ? 'text-gd' : 'text-gray-700')}>
                  {format(d, 'd')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Task rows */}
        {tasks.map((task) => {
          const { left, width, isOverdue } = getBarStyle(task)
          return (
            <div key={task.id} className="flex border-b border-gs/30 hover:bg-page-bg/60 group">
              {/* Task name cell */}
              <div className="w-[200px] shrink-0 px-3 py-2 border-r border-gs/60 flex items-center gap-2">
                <span
                  className={clsx('w-2 h-2 rounded-full shrink-0', PRIORITY_COLOR[task.priority] ?? 'bg-gray-300')}
                />
                <button
                  onClick={() => onOpenDetail(task.id)}
                  className="text-xs text-gray-700 font-medium truncate hover:text-gd transition-colors text-left"
                  title={task.title}
                >
                  {task.title}
                </button>
                {task.isBlocked && (
                  <i className="ti ti-lock text-[10px] text-red-400 shrink-0" aria-hidden="true" />
                )}
              </div>

              {/* Bar area */}
              <div className="relative flex-1" style={{ width: totalWidth, height: 40 }}>
                {/* Today line */}
                {todayOffset >= 0 && todayOffset < VISIBLE_DAYS && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-gd/30 z-0"
                    style={{ left: todayOffset * DAY_WIDTH }}
                  />
                )}

                {/* Bar */}
                <button
                  onClick={() => onOpenDetail(task.id)}
                  title={task.title}
                  className={clsx(
                    'absolute top-1/2 -translate-y-1/2 rounded-full h-5 flex items-center px-2 text-[10px] text-white font-medium truncate z-10 transition-all',
                    isOverdue
                      ? 'bg-red-500 hover:bg-red-600'
                      : (PRIORITY_BAR[task.priority] ?? 'bg-gray-400 hover:bg-gray-500'),
                  )}
                  style={{ left, width: Math.max(width, 8) }}
                >
                  {width > 50 && task.title}
                </button>
              </div>
            </div>
          )
        })}

        {/* Tasks without dates (summary row) */}
        {tasksWithoutDates.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/60 border-t border-gs/30">
            <i className="ti ti-calendar-off text-xs text-gx" aria-hidden="true" />
            <span className="text-xs text-gx">
              +{tasksWithoutDates.length} tarefa{tasksWithoutDates.length > 1 ? 's' : ''} sem data (não exibida{tasksWithoutDates.length > 1 ? 's' : ''})
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
