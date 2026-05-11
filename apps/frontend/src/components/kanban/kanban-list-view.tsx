'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import type { KanbanBoardData } from '@/hooks/use-kanban'

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-gray-300', MEDIUM: 'bg-blue-400', HIGH: 'bg-yellow-400', URGENT: 'bg-red-500',
}
const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente',
}

interface Props {
  board: KanbanBoardData
  onOpenDetail: (taskId: string) => void
}

type SortKey = 'priority' | 'dueDate' | 'column'
const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

export function KanbanListView({ board, onOpenDetail }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('column')

  const allTasks = board.columns.flatMap((col) =>
    col.tasks.map((t) => ({ ...t, columnName: col.name, columnColor: col.color })),
  )

  const sorted = [...allTasks].sort((a, b) => {
    if (sortKey === 'priority') return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
    if (sortKey === 'dueDate') {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    }
    return 0 // column order preserved by flatMap
  })

  return (
    <div className="space-y-3">
      {/* Sort controls */}
      <div className="flex items-center gap-2 text-xs text-gx">
        <span>Ordenar por:</span>
        {(['column', 'priority', 'dueDate'] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSortKey(k)}
            className={clsx(
              'px-2 py-1 rounded-lg transition-colors',
              sortKey === k ? 'bg-gd text-white' : 'bg-page-bg hover:bg-gs/40 text-gray-600',
            )}
          >
            {k === 'column' ? 'Coluna' : k === 'priority' ? 'Prioridade' : 'Prazo'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gs/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gs/60 bg-page-bg">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gx uppercase tracking-wide">Tarefa</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gx uppercase tracking-wide hidden md:table-cell">Coluna</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gx uppercase tracking-wide hidden lg:table-cell">Prioridade</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gx uppercase tracking-wide hidden lg:table-cell">Prazo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gx uppercase tracking-wide hidden xl:table-cell">Checklist</th>
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gs/40">
            {sorted.map((task) => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()
              const checkTotal = task._count.checklists
              return (
                <tr
                  key={task.id}
                  onClick={() => onOpenDetail(task.id)}
                  className="hover:bg-page-bg/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {task.isBlocked && (
                        <i className="ti ti-lock text-red-400 text-xs shrink-0" aria-hidden="true" />
                      )}
                      <span className="font-medium text-gray-800 line-clamp-1">{task.title}</span>
                    </div>
                    {task._count.impediments > 0 && (
                      <span className="text-[10px] text-red-500 flex items-center gap-0.5 mt-0.5">
                        <i className="ti ti-alert-triangle text-[10px]" aria-hidden="true" />
                        {task._count.impediments} impedimento(s)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-gray-600">{task.columnName}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className={clsx('w-2 h-2 rounded-full shrink-0', PRIORITY_DOT[task.priority])} />
                      {PRIORITY_LABEL[task.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {task.dueDate ? (
                      <span className={clsx('text-xs', isOverdue ? 'text-red-500 font-medium' : 'text-gray-600')}>
                        {new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                    ) : (
                      <span className="text-xs text-gx">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {checkTotal > 0 ? (
                      <span className="text-xs text-gx flex items-center gap-1">
                        <i className="ti ti-checklist text-xs" aria-hidden="true" />
                        {checkTotal}
                      </span>
                    ) : (
                      <span className="text-xs text-gx">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <i className="ti ti-chevron-right text-gx text-sm" aria-hidden="true" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div className="py-12 text-center">
            <i className="ti ti-list text-3xl text-gx mb-2 block" aria-hidden="true" />
            <p className="text-sm text-gx">Nenhuma tarefa</p>
          </div>
        )}
      </div>
    </div>
  )
}
