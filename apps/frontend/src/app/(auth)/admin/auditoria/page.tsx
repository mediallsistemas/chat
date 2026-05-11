'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/shared'
import { Button } from '@/components/ui'
import { useAuditLogs } from '@/hooks/use-audit-logs'

const ACTION_CONFIG: Record<string, { label: string; color: string }> = {
  CREATE: { label: 'Criação', color: 'text-green-700 bg-green-50' },
  UPDATE: { label: 'Atualização', color: 'text-blue-700 bg-blue-50' },
  DELETE: { label: 'Exclusão', color: 'text-red-700 bg-red-50' },
}

const ENTITY_LABELS: Record<string, string> = {
  task: 'Tarefa',
  impediment: 'Impedimento',
  plan: 'Plano',
  objective: 'Objetivo',
  goal: 'Meta',
  group: 'Grupo',
  meeting: 'Reunião',
  user: 'Usuário',
  unit: 'Unidade',
}

const ENTITY_TYPES = ['', 'task', 'impediment', 'plan', 'objective', 'goal', 'group', 'meeting', 'user', 'unit']
const ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE']

export default function AuditoriaPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')

  const { data, isLoading } = useAuditLogs({ page, limit: 50, action: action || undefined, entityType: entityType || undefined })

  function applyFilter() {
    setPage(1)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="Auditoria" subtitle="Registro de todas as ações realizadas no sistema" />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gs/60 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gd mb-1">Ação</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="input text-sm h-8"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a || 'Todas'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gd mb-1">Entidade</label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="input text-sm h-8"
          >
            {ENTITY_TYPES.map((e) => (
              <option key={e} value={e}>{e ? (ENTITY_LABELS[e] ?? e) : 'Todas'}</option>
            ))}
          </select>
        </div>
        <Button size="sm" onClick={applyFilter}>
          <i className="ti ti-filter" /> Filtrar
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gs/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gs/40 bg-gs/5">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gd">Data/Hora</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gd">Usuário</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gd">Ação</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gd">Entidade</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gd">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-gs/20">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gs/20 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            )}

            {!isLoading && data?.logs.map((log) => {
              const actionCfg = ACTION_CONFIG[log.action] ?? { label: log.action, color: 'text-gs bg-gs/10' }
              return (
                <tr key={log.id} className="border-b border-gs/20 hover:bg-gs/5 transition-colors">
                  <td className="px-4 py-3 text-xs text-gd whitespace-nowrap">
                    {format(new Date(log.createdAt), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-gd">{log.user?.name ?? log.userId}</div>
                    <div className="text-[10px] text-gs">{log.user?.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', actionCfg.color)}>
                      {actionCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gd">
                    {log.entityType ? (ENTITY_LABELS[log.entityType] ?? log.entityType) : '—'}
                    {log.entityId && (
                      <div className="text-[10px] text-gs font-mono truncate max-w-[120px]">{log.entityId}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gs font-mono">{log.ipAddress}</td>
                </tr>
              )
            })}

            {!isLoading && data?.logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gs text-sm">
                  Nenhum registro de auditoria encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gs/40">
            <span className="text-xs text-gs">
              {data.total} registros · página {data.page} de {data.totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <i className="ti ti-chevron-left" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <i className="ti ti-chevron-right" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
