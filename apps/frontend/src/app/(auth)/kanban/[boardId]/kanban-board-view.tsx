'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { Button, Avatar } from '@/components/ui'

type Priority = 'HIGH' | 'MEDIUM' | 'LOW'
type TaskStatus = 'BLOCKED' | 'ATTENTION' | null

interface KanbanTask {
  id: string
  title: string
  assignee: string
  priority: Priority
  tags: string[]
  checklistTotal: number
  checklistDone: number
  status: TaskStatus
  dueDate?: string
}

interface KanbanColumn {
  id: string
  title: string
  color: string
  tasks: KanbanTask[]
  wipLimit?: number
}

const PRIORITY_CONFIG: Record<Priority, { dot: string; label: string }> = {
  HIGH:   { dot: 'bg-red-500',    label: 'Alta' },
  MEDIUM: { dot: 'bg-yellow-400', label: 'Média' },
  LOW:    { dot: 'bg-gray-300',   label: 'Baixa' },
}

// Mock data
const MOCK_COLUMNS: KanbanColumn[] = [
  {
    id: 'backlog',
    title: 'Backlog',
    color: 'bg-gray-400',
    wipLimit: undefined,
    tasks: [
      { id: 't1', title: 'Mapear processos de triagem', assignee: 'Ana P.', priority: 'MEDIUM', tags: ['Triagem'], checklistTotal: 4, checklistDone: 0, status: null },
      { id: 't2', title: 'Documentar protocolo de emergência', assignee: 'Carlos M.', priority: 'LOW', tags: ['Protocolo', 'Docs'], checklistTotal: 3, checklistDone: 0, status: null },
    ],
  },
  {
    id: 'in-progress',
    title: 'Em andamento',
    color: 'bg-blue-400',
    wipLimit: 3,
    tasks: [
      { id: 't3', title: 'Treinamento equipe de enfermagem', assignee: 'Rafael M.', priority: 'HIGH', tags: ['RH', 'Treinamento'], checklistTotal: 5, checklistDone: 3, status: null, dueDate: '10/05' },
      { id: 't4', title: 'Integração com sistema BI', assignee: 'Gabriel A.', priority: 'HIGH', tags: ['TI'], checklistTotal: 6, checklistDone: 2, status: 'BLOCKED', dueDate: '08/05' },
    ],
  },
  {
    id: 'blocked',
    title: 'Impedido',
    color: 'bg-red-400',
    tasks: [
      { id: 't5', title: 'Atualizar prontuário eletrônico', assignee: 'Ana P.', priority: 'HIGH', tags: ['TI', 'Urgente'], checklistTotal: 2, checklistDone: 0, status: 'BLOCKED', dueDate: '05/05' },
    ],
  },
  {
    id: 'review',
    title: 'Em revisão',
    color: 'bg-yellow-400',
    tasks: [
      { id: 't6', title: 'Relatório de ocupação de leitos', assignee: 'Carlos M.', priority: 'MEDIUM', tags: ['Relatório'], checklistTotal: 3, checklistDone: 3, status: null },
    ],
  },
  {
    id: 'done',
    title: 'Concluído',
    color: 'bg-green-400',
    tasks: [
      { id: 't7', title: 'Auditoria de escalas', assignee: 'Rafael M.', priority: 'LOW', tags: ['RH'], checklistTotal: 4, checklistDone: 4, status: null },
      { id: 't8', title: 'Revisão de indicadores Q1', assignee: 'Gabriel A.', priority: 'MEDIUM', tags: ['Indicadores'], checklistTotal: 5, checklistDone: 5, status: null },
    ],
  },
]

function TaskCard({ task }: { task: KanbanTask }) {
  const priority = PRIORITY_CONFIG[task.priority]
  const overdue = task.dueDate && task.status !== null

  return (
    <div
      className={clsx(
        'bg-white rounded-xl border p-3 cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md',
        task.status === 'BLOCKED' ? 'border-red-200' : 'border-gs/60',
      )}
    >
      {/* Impediment badge */}
      {task.status === 'BLOCKED' && (
        <div className="flex items-center gap-1 mb-2 text-xs font-semibold text-red-500">
          <i className="ti ti-alert-triangle text-sm" aria-hidden="true" />
          Impedido
        </div>
      )}

      {/* Title */}
      <p className="text-sm font-medium text-gray-800 leading-snug mb-2">{task.title}</p>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 bg-page-bg text-gx text-[10px] rounded font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {/* Priority dot */}
          <span
            className={clsx('w-2 h-2 rounded-full shrink-0', priority.dot)}
            title={`Prioridade: ${priority.label}`}
            aria-label={`Prioridade ${priority.label}`}
          />

          {/* Checklist */}
          {task.checklistTotal > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-gx">
              <i className="ti ti-checkbox text-xs" aria-hidden="true" />
              {task.checklistDone}/{task.checklistTotal}
            </span>
          )}

          {/* Due date */}
          {task.dueDate && (
            <span className={clsx('text-[11px] flex items-center gap-0.5', overdue ? 'text-red-500' : 'text-gx')}>
              <i className="ti ti-calendar text-xs" aria-hidden="true" />
              {task.dueDate}
            </span>
          )}
        </div>

        <Avatar name={task.assignee} size="xs" />
      </div>
    </div>
  )
}

function KanbanColumnView({ column }: { column: KanbanColumn }) {
  const atWip = column.wipLimit && column.tasks.length >= column.wipLimit

  return (
    <div className="flex flex-col w-64 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={clsx('w-2.5 h-2.5 rounded-full', column.color)} aria-hidden="true" />
          <span className="text-sm font-semibold text-gray-700 font-sora">{column.title}</span>
          <span
            className={clsx(
              'text-xs px-1.5 py-0.5 rounded-full font-medium',
              atWip ? 'bg-yellow-100 text-yellow-700' : 'bg-page-bg text-gx',
            )}
            aria-label={`${column.tasks.length} tarefas${column.wipLimit ? ` (limite: ${column.wipLimit})` : ''}`}
          >
            {column.tasks.length}{column.wipLimit ? `/${column.wipLimit}` : ''}
          </span>
        </div>
        <button
          aria-label={`Adicionar tarefa em ${column.title}`}
          className="p-1 rounded-lg text-gx hover:bg-page-bg hover:text-gd transition-colors"
        >
          <i className="ti ti-plus text-sm" aria-hidden="true" />
        </button>
      </div>

      {/* Tasks */}
      <div className="flex flex-col gap-2 flex-1 min-h-[120px]">
        {column.tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}

interface KanbanBoardViewProps {
  boardId: string
}

export function KanbanBoardView({ boardId: _ }: KanbanBoardViewProps) {
  const [columns] = useState(MOCK_COLUMNS)

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Board header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gs/60 shrink-0">
        <div>
          <h2 className="text-base font-bold text-gray-900 font-sora">Etapa 2 — Planejamento</h2>
          <p className="text-xs text-gx">Meta: Reduzir leitos ociosos · UEI</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-sm text-gx hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-page-bg transition-colors">
            <i className="ti ti-filter text-base" aria-hidden="true" />
            Filtrar
          </button>
          <Button size="sm">
            <i className="ti ti-plus text-sm" aria-hidden="true" />
            Nova tarefa
          </Button>
        </div>
      </div>

      {/* Columns scroll area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {columns.map((col) => (
            <KanbanColumnView key={col.id} column={col} />
          ))}
        </div>
      </div>
    </div>
  )
}
