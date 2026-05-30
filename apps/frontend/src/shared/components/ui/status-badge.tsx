import { clsx } from 'clsx'
import { TicketStatus, TicketPriority } from '@mediall/types'

const TICKET_STATUS_STYLE: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'bg-blue-50 text-blue-700',
  [TicketStatus.IN_PROGRESS]: 'bg-yellow-50 text-yellow-700',
  [TicketStatus.PENDING]: 'bg-orange-50 text-orange-700',
  [TicketStatus.RESOLVED]: 'bg-green-50 text-green-700',
  [TicketStatus.CLOSED]: 'bg-gs/10 text-gs',
}

const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'Aberto',
  [TicketStatus.IN_PROGRESS]: 'Em andamento',
  [TicketStatus.PENDING]: 'Pendente',
  [TicketStatus.RESOLVED]: 'Resolvido',
  [TicketStatus.CLOSED]: 'Fechado',
}

const TICKET_PRIORITY_STYLE: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'text-gs',
  [TicketPriority.MEDIUM]: 'text-blue-600',
  [TicketPriority.HIGH]: 'text-orange-600',
  [TicketPriority.CRITICAL]: 'text-red-600',
}

const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'Baixa',
  [TicketPriority.MEDIUM]: 'Média',
  [TicketPriority.HIGH]: 'Alta',
  [TicketPriority.CRITICAL]: 'Crítica',
}

const TICKET_PRIORITY_ICON: Record<TicketPriority, string> = {
  [TicketPriority.LOW]: 'ti-arrow-down',
  [TicketPriority.MEDIUM]: 'ti-minus',
  [TicketPriority.HIGH]: 'ti-arrow-up',
  [TicketPriority.CRITICAL]: 'ti-flame',
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', TICKET_STATUS_STYLE[status])}>
      {TICKET_STATUS_LABEL[status]}
    </span>
  )
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={clsx('flex items-center gap-1 text-xs font-medium', TICKET_PRIORITY_STYLE[priority])}>
      <i className={`ti ${TICKET_PRIORITY_ICON[priority]} text-[13px]`} aria-hidden="true" />
      {TICKET_PRIORITY_LABEL[priority]}
    </span>
  )
}
