'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import type { KanbanBoardData, KanbanTaskItem } from '@/features/kanban/hooks/use-kanban'

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-gray-300', MEDIUM: 'bg-blue-400', HIGH: 'bg-yellow-400', URGENT: 'bg-red-500',
}

interface Props {
  board: KanbanBoardData
  onOpenDetail: (taskId: string) => void
}

function getMonthMatrix(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Monday = 0
  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = Array(startDow).fill(null)

  for (let d = 1; d <= lastDay.getDate(); d++) {
    week.push(new Date(year, month, d))
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

// Local YYYY-MM-DD key — avoids toISOString() shifting the date across timezones.
function toLocalKey(d: Date) {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export function KanbanCalendarView({ board, onOpenDetail }: Props) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const weeks = getMonthMatrix(viewYear, viewMonth)

  const allTasks = board.columns.flatMap((col) => col.tasks)

  // Group tasks by due date
  const tasksByDay = new Map<string, KanbanTaskItem[]>()
  for (const task of allTasks) {
    if (!task.dueDate) continue
    const key = task.dueDate.slice(0, 10)
    if (!tasksByDay.has(key)) tasksByDay.set(key, [])
    tasksByDay.get(key)!.push(task)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11) }
    else setViewMonth((m) => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0) }
    else setViewMonth((m) => m + 1)
  }

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg text-gx hover:bg-page-bg hover:text-gray-800 transition-colors"
          aria-label="Mês anterior"
        >
          <i className="ti ti-chevron-left text-sm" aria-hidden="true" />
        </button>
        <h3 className="text-sm font-semibold text-gray-800 min-w-[160px] text-center">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h3>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg text-gx hover:bg-page-bg hover:text-gray-800 transition-colors"
          aria-label="Próximo mês"
        >
          <i className="ti ti-chevron-right text-sm" aria-hidden="true" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gs/60">
          {DAY_LABELS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-gx">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className={clsx('grid grid-cols-7', wi < weeks.length - 1 && 'border-b border-gs/60')}>
            {week.map((day, di) => {
              const isToday = day ? isSameDay(day, now) : false
              const dayKey = day ? toLocalKey(day) : null
              const dayTasks = dayKey ? (tasksByDay.get(dayKey) ?? []) : []

              return (
                <div
                  key={di}
                  className={clsx(
                    'min-h-[80px] p-1.5 border-r border-gs/40 last:border-r-0',
                    !day && 'bg-page-bg/30',
                    di >= 5 && 'bg-page-bg/20',
                  )}
                >
                  {day && (
                    <>
                      <span
                        className={clsx(
                          'inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-1',
                          isToday ? 'bg-gd text-white' : 'text-gray-600',
                        )}
                      >
                        {day.getDate()}
                      </span>
                      <div className="space-y-0.5">
                        {dayTasks.slice(0, 3).map((task) => (
                          <button
                            key={task.id}
                            onClick={() => onOpenDetail(task.id)}
                            title={task.title}
                            className={clsx(
                              'w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1',
                              task.isBlocked
                                ? 'bg-red-50 text-red-600'
                                : 'bg-gd/10 text-gd hover:bg-gd/20',
                            )}
                          >
                            <span
                              className={clsx('w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_DOT[task.priority])}
                              aria-hidden="true"
                            />
                            <span className="truncate">{task.title}</span>
                          </button>
                        ))}
                        {dayTasks.length > 3 && (
                          <p className="text-[10px] text-gx pl-1">
                            +{dayTasks.length - 3} mais
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Tasks without due date */}
      {allTasks.some((t) => !t.dueDate) && (
        <div className="bg-white rounded-xl border border-gs/60 p-4">
          <h4 className="text-xs font-semibold text-gx uppercase tracking-wide mb-2">Sem prazo definido</h4>
          <div className="flex flex-wrap gap-2">
            {allTasks
              .filter((t) => !t.dueDate)
              .map((task) => (
                <button
                  key={task.id}
                  onClick={() => onOpenDetail(task.id)}
                  className="text-xs px-2 py-1 rounded-lg bg-page-bg text-gray-600 hover:bg-gs/40 transition-colors flex items-center gap-1.5"
                >
                  <span
                    className={clsx('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[task.priority])}
                    aria-hidden="true"
                  />
                  {task.title}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
