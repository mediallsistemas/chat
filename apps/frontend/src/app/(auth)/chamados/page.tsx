'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { clsx } from 'clsx'
import { PageHeader } from '@/components/shared'
import { Button, Modal, FormModal, SkeletonList, EmptyState, TicketStatusBadge, TicketPriorityBadge, FormField } from '@/components/ui'
import {
  useTickets,
  useTicketStats,
  useCreateTicket,
  useUpdateTicket,
} from '@/hooks/use-tickets'
import { TicketStatus, TicketPriority } from '@mediall/types'
import type { Ticket } from '@mediall/types'

const createTicketSchema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres').max(200, 'Máximo 200 caracteres'),
  description: z.string().min(10, 'Descreva o problema com mais detalhes'),
  priority: z.nativeEnum(TicketPriority),
  category: z.string().optional(),
  dueDate: z.string().optional(),
})
type CreateTicketForm = z.infer<typeof createTicketSchema>

const STATUS_LABEL: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'Aberto',
  [TicketStatus.IN_PROGRESS]: 'Em andamento',
  [TicketStatus.PENDING]: 'Pendente',
  [TicketStatus.RESOLVED]: 'Resolvido',
  [TicketStatus.CLOSED]: 'Fechado',
}

const STATUS_STYLE: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'bg-blue-50 text-blue-700',
  [TicketStatus.IN_PROGRESS]: 'bg-yellow-50 text-yellow-700',
  [TicketStatus.PENDING]: 'bg-orange-50 text-orange-700',
  [TicketStatus.RESOLVED]: 'bg-green-50 text-green-700',
  [TicketStatus.CLOSED]: 'bg-gs/10 text-gs',
}

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'Baixa',
  [TicketPriority.MEDIUM]: 'Média',
  [TicketPriority.HIGH]: 'Alta',
  [TicketPriority.CRITICAL]: 'Crítica',
}

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'text-gs',
  [TicketPriority.MEDIUM]: 'text-blue-600',
  [TicketPriority.HIGH]: 'text-orange-600',
  [TicketPriority.CRITICAL]: 'text-red-600',
}

const PRIORITY_ICON: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'ti-arrow-down',
  [TicketPriority.MEDIUM]: 'ti-minus',
  [TicketPriority.HIGH]: 'ti-arrow-up',
  [TicketPriority.CRITICAL]: 'ti-flame',
}

const STATUS_TABS: Array<{ label: string; value: TicketStatus | undefined }> = [
  { label: 'Todos', value: undefined },
  { label: 'Abertos', value: TicketStatus.OPEN },
  { label: 'Em andamento', value: TicketStatus.IN_PROGRESS },
  { label: 'Resolvidos', value: TicketStatus.RESOLVED },
]

export default function ChamadosPage() {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | undefined>(undefined)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  const { data: tickets = [], isLoading } = useTickets(statusFilter)
  const { data: stats } = useTicketStats()
  const createTicket = useCreateTicket()
  const updateTicket = useUpdateTicket()

  const form = useForm<CreateTicketForm>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { title: '', description: '', priority: TicketPriority.MEDIUM, category: '', dueDate: '' },
  })

  async function handleCreate(data: CreateTicketForm) {
    await createTicket.mutateAsync({
      title: data.title,
      description: data.description,
      priority: data.priority,
      category: data.category || undefined,
      dueDate: data.dueDate || undefined,
    })
    form.reset()
    setShowCreate(false)
  }

  function handleCloseCreate() {
    form.reset()
    setShowCreate(false)
  }

  async function handleStatusChange(ticket: Ticket, status: TicketStatus) {
    await updateTicket.mutateAsync({ ticketId: ticket.id, dto: { status } })
    if (selectedTicket?.id === ticket.id) {
      setSelectedTicket({ ...ticket, status })
    }
  }

  const statCards = [
    { label: 'Abertos', value: stats?.open ?? 0, icon: 'ti-ticket', color: 'text-blue-600 bg-blue-50' },
    { label: 'Em andamento', value: stats?.inProgress ?? 0, icon: 'ti-loader-2', color: 'text-yellow-600 bg-yellow-50' },
    { label: 'Resolvidos', value: stats?.resolved ?? 0, icon: 'ti-circle-check', color: 'text-green-600 bg-green-50' },
    { label: 'Críticos', value: stats?.critical ?? 0, icon: 'ti-flame', color: 'text-red-600 bg-red-50' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Chamados" subtitle="Central de atendimento e suporte interno" />
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <i className="ti ti-plus mr-1" /> Novo chamado
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gs/60 p-4 flex items-center gap-3">
            <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', s.color)}>
              <i className={`ti ${s.icon} text-xl`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gd font-sora">{s.value}</p>
              <p className="text-xs text-gs">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-page-bg rounded-lg p-1 self-start w-fit border border-gs/40">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={clsx(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              statusFilter === tab.value ? 'bg-white text-gd shadow-sm' : 'text-gs hover:text-gd',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-gs/10 animate-pulse" />)}
        </div>
      )}

      {!isLoading && tickets.length === 0 && (
        <div className="text-center py-20 text-gs">
          <i className="ti ti-ticket text-4xl block mb-3 opacity-30" />
          <p className="text-sm">Nenhum chamado encontrado.</p>
        </div>
      )}

      {!isLoading && tickets.length > 0 && (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => setSelectedTicket(ticket)}
              className="w-full text-left bg-white rounded-xl border border-gs/60 p-4 hover:border-gn/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_STYLE[ticket.status])}>
                      {STATUS_LABEL[ticket.status]}
                    </span>
                    <span className={clsx('flex items-center gap-1 text-xs font-medium', PRIORITY_STYLE[ticket.priority])}>
                      <i className={`ti ${PRIORITY_ICON[ticket.priority]} text-[13px]`} />
                      {PRIORITY_LABEL[ticket.priority]}
                    </span>
                    {ticket.category && (
                      <span className="text-xs text-gs bg-gs/10 px-2 py-0.5 rounded-full">{ticket.category}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gd truncate">{ticket.title}</p>
                  <p className="text-xs text-gs mt-0.5 line-clamp-1">{ticket.description}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-gs space-y-1">
                  {ticket.assignee && (
                    <div className="flex items-center gap-1 justify-end">
                      <div className="w-5 h-5 rounded-full bg-gn/20 flex items-center justify-center text-gd text-[10px] font-bold">
                        {ticket.assignee.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{ticket.assignee.name.split(' ')[0]}</span>
                    </div>
                  )}
                  <div>{format(new Date(ticket.createdAt), "d MMM yyyy", { locale: ptBR })}</div>
                  {ticket._count && ticket._count.comments > 0 && (
                    <div className="flex items-center gap-1 justify-end">
                      <i className="ti ti-message text-[12px]" />
                      {ticket._count.comments}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create modal */}
      <FormModal
        open={showCreate}
        onClose={handleCloseCreate}
        title="Novo chamado"
        size="sm"
        onSubmit={form.handleSubmit(handleCreate)}
        isPending={createTicket.isPending}
        submitLabel="Criar chamado"
      >
        <FormField label="Título" error={form.formState.errors.title} required>
          <input
            autoFocus
            {...form.register('title')}
            className="input w-full"
            placeholder="Descreva o problema brevemente"
          />
        </FormField>
        <FormField label="Descrição" error={form.formState.errors.description} required>
          <textarea
            {...form.register('description')}
            className="input w-full resize-none"
            rows={3}
            placeholder="Detalhe o problema, contexto e impacto"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Prioridade">
            <select {...form.register('priority')} className="input w-full">
              {Object.values(TicketPriority).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Categoria" error={form.formState.errors.category}>
            <input
              {...form.register('category')}
              className="input w-full"
              placeholder="TI, RH, Infraestrutura..."
            />
          </FormField>
        </div>
        <FormField label="Prazo (opcional)">
          <input type="date" {...form.register('dueDate')} className="input w-full" />
        </FormField>
      </FormModal>

      {/* Ticket detail modal */}
      {selectedTicket && (
        <Modal open={!!selectedTicket} onClose={() => setSelectedTicket(null)} title="Detalhes do chamado" size="sm">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', STATUS_STYLE[selectedTicket.status])}>
                    {STATUS_LABEL[selectedTicket.status]}
                  </span>
                  <span className={clsx('flex items-center gap-1 text-xs font-medium', PRIORITY_STYLE[selectedTicket.priority])}>
                    <i className={`ti ${PRIORITY_ICON[selectedTicket.priority]} text-[13px]`} />
                    {PRIORITY_LABEL[selectedTicket.priority]}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-gd">{selectedTicket.title}</h3>
                <p className="text-sm text-gs mt-1 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>
            </div>

            <div className="text-xs text-gs space-y-1 border-t border-gs/20 pt-3">
              {selectedTicket.reporter && (
                <div>Aberto por: <span className="text-gd font-medium">{selectedTicket.reporter.name}</span></div>
              )}
              {selectedTicket.assignee && (
                <div>Responsável: <span className="text-gd font-medium">{selectedTicket.assignee.name}</span></div>
              )}
              {selectedTicket.dueDate && (
                <div>Prazo: <span className="text-gd font-medium">{format(new Date(selectedTicket.dueDate), "d 'de' MMMM yyyy", { locale: ptBR })}</span></div>
              )}
              <div>Criado em: {format(new Date(selectedTicket.createdAt), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}</div>
            </div>

            {selectedTicket.status !== TicketStatus.CLOSED && selectedTicket.status !== TicketStatus.RESOLVED && (
              <div>
                <label className="block text-sm font-medium text-gd mb-1">Atualizar status</label>
                <div className="flex flex-wrap gap-2">
                  {([TicketStatus.IN_PROGRESS, TicketStatus.PENDING, TicketStatus.RESOLVED, TicketStatus.CLOSED] as TicketStatus[])
                    .filter((s) => s !== selectedTicket.status)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(selectedTicket, s)}
                        disabled={updateTicket.isPending}
                        className={clsx('text-xs px-3 py-1.5 rounded-lg border border-gs/40 hover:border-gn transition-colors disabled:opacity-50 disabled:cursor-not-allowed', STATUS_STYLE[s])}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button variant="secondary" onClick={() => setSelectedTicket(null)}>Fechar</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
