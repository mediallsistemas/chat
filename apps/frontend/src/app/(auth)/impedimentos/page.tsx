'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { PageHeader, MetricCard } from '@/shared/components'
import { Button, Avatar, FormModal } from '@/shared/components/ui'
import {
  useImpediments,
  useImpedimentAnalytics,
  useResolveImpediment,
  type ImpedimentWithTask,
} from '@/features/impediments/hooks/use-impediments'
import { useDownloadImpedimentsPdf, useDownloadImpedimentsExcel } from '@/features/reports/hooks/use-reports'
import { ImpedimentStatus } from '@mediall/types'

const STATUS_CONFIG: Record<ImpedimentStatus, { label: string; bg: string; text: string; dot: string }> = {
  [ImpedimentStatus.BLOCKED]:   { label: 'Bloqueado',  bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500' },
  [ImpedimentStatus.ATTENTION]: { label: 'Atenção',    bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  [ImpedimentStatus.RESOLVED]:  { label: 'Resolvido',  bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
}

const ESCALATION_LABEL: Record<number, string> = {
  0: 'Responsável notificado',
  1: 'Escalado para gerência',
  2: 'Escalado para diretoria',
}

const resolveSchema = z.object({
  resolutionNotes: z.string().min(5, 'Informe como o impedimento foi resolvido.'),
})
type ResolveForm = z.infer<typeof resolveSchema>

function ImpedimentCard({
  imp,
  onResolve,
}: {
  imp: ImpedimentWithTask
  onResolve: (imp: ImpedimentWithTask) => void
}) {
  const cfg = STATUS_CONFIG[imp.status]
  const daysOpen = Math.floor(
    (Date.now() - new Date(imp.createdAt).getTime()) / 86_400_000,
  )

  return (
    <div
      className={clsx(
        'rounded-xl border p-4',
        imp.status === ImpedimentStatus.RESOLVED
          ? 'border-gs/60 bg-white opacity-70'
          : 'border-gs/60 bg-white',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={clsx('w-2 h-2 rounded-full shrink-0', cfg.dot)} aria-hidden="true" />
            <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.bg, cfg.text)}>
              {cfg.label}
            </span>
            {imp.escalationLevel > 0 && (
              <span className="text-xs text-orange-600 font-medium flex items-center gap-1">
                <i className="ti ti-arrow-up text-xs" aria-hidden="true" />
                {ESCALATION_LABEL[imp.escalationLevel] ?? `Nível ${imp.escalationLevel}`}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-800 mb-0.5">{imp.description}</p>
          <p className="text-xs text-gx mb-1">{imp.task.title}</p>
          {imp.resolutionNotes && (
            <p className="text-xs text-green-700 mt-1 bg-green-50 px-2 py-1 rounded">
              <strong>Resolução:</strong> {imp.resolutionNotes}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-gx mb-1">{daysOpen}d aberto</p>
          <Avatar name={imp.responsibleForResolution} size="sm" />
        </div>
      </div>

      {imp.status !== ImpedimentStatus.RESOLVED && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gs/40">
          <Button size="sm" variant="secondary" onClick={() => onResolve(imp)}>
            <i className="ti ti-check text-sm" aria-hidden="true" />
            Resolver
          </Button>
        </div>
      )}
    </div>
  )
}

export default function ImpedimentosPage() {
  const [filter, setFilter] = useState<ImpedimentStatus | 'ALL'>('ALL')
  const [resolveTarget, setResolveTarget] = useState<ImpedimentWithTask | null>(null)

  const { data: impediments = [], isLoading } = useImpediments()
  const { data: analytics } = useImpedimentAnalytics()
  const { mutate: resolve, isPending: resolving } = useResolveImpediment()
  const { download: downloadPdf, isPending: exportingPdf } = useDownloadImpedimentsPdf()
  const { download: downloadExcel, isPending: exportingExcel } = useDownloadImpedimentsExcel()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResolveForm>({ resolver: zodResolver(resolveSchema) })

  const blocked = impediments.filter((i) => i.status === ImpedimentStatus.BLOCKED)
  const attention = impediments.filter((i) => i.status === ImpedimentStatus.ATTENTION)

  const filtered =
    filter === 'ALL'
      ? impediments.filter((i) => i.status !== ImpedimentStatus.RESOLVED)
      : impediments.filter((i) => i.status === filter)

  function onResolveSubmit(data: ResolveForm) {
    if (!resolveTarget) return
    resolve(
      { impedimentId: resolveTarget.id, resolutionNotes: data.resolutionNotes },
      {
        onSuccess: () => {
          setResolveTarget(null)
          reset()
        },
      },
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Impedimentos" />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={downloadPdf} loading={exportingPdf} aria-label="Exportar PDF">
            <i className="ti ti-file-type-pdf mr-1.5 text-red-500" />
            PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={downloadExcel} loading={exportingExcel} aria-label="Exportar Excel">
            <i className="ti ti-file-type-xls mr-1.5 text-green-600" />
            Excel
          </Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Bloqueadas"
          value={analytics?.blocked ?? blocked.length}
          icon="ti-alert-triangle"
          iconColor="text-red-500"
        />
        <MetricCard
          label="Em atenção"
          value={analytics?.attention ?? attention.length}
          icon="ti-eye"
          iconColor="text-yellow-500"
        />
        <MetricCard
          label="Resolvidas (30d)"
          value={analytics?.resolvedLast30 ?? 0}
          icon="ti-circle-check"
          iconColor="text-green-500"
        />
      </div>

      <div className="flex gap-5 items-start">
        {/* List */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filter tabs */}
          <div className="flex gap-1 bg-page-bg rounded-xl p-1 w-fit">
            {(['ALL', ImpedimentStatus.BLOCKED, ImpedimentStatus.ATTENTION, ImpedimentStatus.RESOLVED] as const).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    filter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gx hover:text-gray-700',
                  )}
                >
                  {f === 'ALL' ? 'Ativos' : STATUS_CONFIG[f as ImpedimentStatus].label}
                </button>
              ),
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-28 rounded-xl bg-gs/30 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <i className="ti ti-shield-check text-4xl text-green-400 mb-3 block" aria-hidden="true" />
              <p className="text-sm text-gx">Nenhum impedimento ativo</p>
            </div>
          ) : (
            filtered.map((imp) => (
              <ImpedimentCard key={imp.id} imp={imp} onResolve={setResolveTarget} />
            ))
          )}
        </div>

        {/* Right sidebar analytics */}
        <aside className="w-56 shrink-0 space-y-4">
          {/* Avg resolution time */}
          {analytics && analytics.avgResolutionHours > 0 && (
            <div className="bg-white rounded-2xl border border-gs/60 p-4">
              <h3 className="text-xs font-semibold text-gx uppercase tracking-wide mb-2">Tempo médio</h3>
              <p className="text-2xl font-bold text-gd">
                {analytics.avgResolutionHours < 24
                  ? `${analytics.avgResolutionHours}h`
                  : `${Math.round(analytics.avgResolutionHours / 24)}d`}
              </p>
              <p className="text-[11px] text-gx mt-0.5">para resolver</p>
            </div>
          )}

          {/* By escalation level */}
          {analytics && (
            <div className="bg-white rounded-2xl border border-gs/60 p-4">
              <h3 className="text-xs font-semibold text-gx uppercase tracking-wide mb-3">Por escalação</h3>
              <div className="space-y-2">
                {analytics.byEscalationLevel.map(({ level, count }) => (
                  <div key={level} className="flex items-center justify-between">
                    <span className="text-xs text-gray-700">{ESCALATION_LABEL[level] ?? `Nível ${level}`}</span>
                    <span
                      className={clsx(
                        'text-xs font-semibold',
                        level === 0 ? 'text-gray-600' : level === 1 ? 'text-orange-500' : 'text-red-500',
                      )}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top assignees */}
          {analytics && analytics.topAssignees.length > 0 && (
            <div className="bg-white rounded-2xl border border-gs/60 p-4">
              <h3 className="text-xs font-semibold text-gx uppercase tracking-wide mb-3">Mais impedimentos</h3>
              <div className="space-y-2">
                {analytics.topAssignees.map((person, i) => (
                  <div key={person.id} className="flex items-center gap-2">
                    <span className="text-[11px] text-gx w-4">{i + 1}.</span>
                    <Avatar name={person.name} size="xs" />
                    <span className="text-xs text-gray-700 flex-1 truncate">{person.name}</span>
                    <span className="text-xs font-semibold text-red-500">{person.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Resolve modal */}
      <FormModal
        open={!!resolveTarget}
        onClose={() => {
          setResolveTarget(null)
          reset()
        }}
        title="Resolver impedimento"
        size="sm"
        onSubmit={handleSubmit(onResolveSubmit)}
        isPending={resolving}
        submitLabel="Confirmar resolução"
      >
        {resolveTarget && (
          <p className="text-sm text-gray-600 bg-page-bg rounded-lg px-3 py-2">
            {resolveTarget.description}
          </p>
        )}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Como foi resolvido?
          </label>
          <textarea
            {...register('resolutionNotes')}
            rows={3}
            placeholder="Descreva a solução adotada..."
            className="w-full px-3 py-2 text-sm border border-gs rounded-xl focus:outline-none focus:border-gd focus:ring-1 focus:ring-gd/20 resize-none"
          />
          {errors.resolutionNotes && (
            <p className="text-xs text-red-500 mt-1">{errors.resolutionNotes.message}</p>
          )}
        </div>
      </FormModal>
    </div>
  )
}
