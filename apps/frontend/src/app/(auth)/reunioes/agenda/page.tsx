'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { clsx } from 'clsx'
import { useAgenda } from '@/hooks/use-meetings'
import type { AgendaItem } from '@mediall/types'

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; dot: string; icon: string }
> = {
  meeting: {
    label: 'Reunião',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
    icon: 'ti-video',
  },
  task: {
    label: 'Tarefa',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
    icon: 'ti-checklist',
  },
  macro_task: {
    label: 'Macro-tarefa',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500',
    icon: 'ti-list-check',
  },
  objective: {
    label: 'Objetivo',
    color: 'bg-green-50 text-green-700 border-green-200',
    dot: 'bg-green-500',
    icon: 'ti-target',
  },
}

function AgendaItemRow({
  item,
  onClick,
}: {
  item: AgendaItem
  onClick: () => void
}) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.task
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-opacity hover:opacity-80',
        cfg.color,
      )}
    >
      <i className={`ti ${cfg.icon} text-[13px] shrink-0`} />
      <span className="truncate font-medium">{item.title}</span>
      {item.type === 'meeting' && item.endDate && (
        <span className="ml-auto text-xs opacity-70 shrink-0">
          {format(new Date(item.date), 'HH:mm')}–{format(new Date(item.endDate), 'HH:mm')}
        </span>
      )}
    </button>
  )
}

export default function AgendaPage() {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())

  const from = startOfMonth(currentMonth)
  const to = endOfMonth(currentMonth)

  const { data: items = [], isLoading } = useAgenda(from, to)

  const itemsByDay = items.reduce<Record<string, AgendaItem[]>>((acc, item) => {
    const key = format(new Date(item.date), 'yyyy-MM-dd')
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  const selectedKey = format(selectedDay, 'yyyy-MM-dd')
  const selectedItems = itemsByDay[selectedKey] ?? []

  // Build calendar grid weeks
  const gridStart = startOfWeek(from, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(to, { weekStartsOn: 0 })
  const weeks: Date[][] = []
  let day = gridStart
  while (day <= gridEnd) {
    const week: Date[] = []
    for (let i = 0; i < 7; i++) {
      week.push(day)
      day = addDays(day, 1)
    }
    weeks.push(week)
  }

  function handleItemClick(item: AgendaItem) {
    if (item.type === 'meeting') {
      router.push(`/reunioes/${item.id}`)
    } else if (item.type === 'task' && item.meta?.boardId) {
      router.push(`/kanban/${item.meta.boardId}`)
    } else if (item.type === 'objective' && item.meta?.planId) {
      router.push(`/processos/${item.meta.planId}/${item.id}`)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Page header + nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/reunioes')}
            className="flex items-center gap-1 text-sm text-gs hover:text-gd transition-colors"
          >
            <i className="ti ti-arrow-left" /> Reuniões
          </button>
          <h1 className="text-xl font-bold text-gd">Agenda</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-gs/10 transition-colors"
            aria-label="Mês anterior"
          >
            <i className="ti ti-chevron-left text-[18px] text-gd" />
          </button>
          <span className="text-sm font-semibold text-gd w-36 text-center capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 rounded-lg hover:bg-gs/10 transition-colors"
            aria-label="Próximo mês"
          >
            <i className="ti ti-chevron-right text-[18px] text-gd" />
          </button>
          <button
            onClick={() => {
              setCurrentMonth(new Date())
              setSelectedDay(new Date())
            }}
            className="ml-1 text-xs px-3 py-1.5 rounded-lg border border-gs/40 hover:bg-gs/10 text-gd transition-colors"
          >
            Hoje
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        {/* Calendar grid */}
        <div className="bg-white rounded-xl border border-gs/60 overflow-hidden">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 border-b border-gs/20">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-semibold text-gs uppercase tracking-wide"
              >
                {d}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-gs">
              <i className="ti ti-loader animate-spin text-2xl" />
            </div>
          ) : (
            weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gs/10 last:border-0">
                {week.map((d) => {
                  const key = format(d, 'yyyy-MM-dd')
                  const dayItems = itemsByDay[key] ?? []
                  const isSelected = isSameDay(d, selectedDay)
                  const inMonth = isSameMonth(d, currentMonth)
                  const today = isToday(d)

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDay(d)}
                      className={clsx(
                        'min-h-[80px] p-1.5 text-left border-r border-gs/10 last:border-0 transition-colors',
                        isSelected ? 'bg-gn/10' : 'hover:bg-gs/5',
                        !inMonth && 'opacity-30',
                      )}
                    >
                      <span
                        className={clsx(
                          'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mb-1',
                          today
                            ? 'bg-gn text-gd'
                            : isSelected
                              ? 'bg-gd text-white'
                              : 'text-gd',
                        )}
                      >
                        {format(d, 'd')}
                      </span>

                      <div className="space-y-0.5">
                        {dayItems.slice(0, 3).map((item) => {
                          const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.task
                          return (
                            <div
                              key={item.id}
                              className={clsx(
                                'flex items-center gap-1 text-[10px] leading-tight px-1 py-0.5 rounded truncate',
                                cfg.color,
                              )}
                            >
                              <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
                              <span className="truncate">{item.title}</span>
                            </div>
                          )
                        })}
                        {dayItems.length > 3 && (
                          <div className="text-[10px] text-gs px-1">
                            +{dayItems.length - 3} mais
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Day detail panel */}
        <div className="bg-white rounded-xl border border-gs/60 p-4 space-y-3">
          <h2 className="font-semibold text-gd capitalize">
            {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h2>

          {selectedItems.length === 0 ? (
            <p className="text-sm text-gs">Nenhum evento neste dia.</p>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((item) => (
                <AgendaItemRow
                  key={item.id}
                  item={item}
                  onClick={() => handleItemClick(item)}
                />
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="pt-3 border-t border-gs/20 space-y-1.5">
            {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-2 text-xs text-gs">
                <span className={clsx('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                {cfg.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
