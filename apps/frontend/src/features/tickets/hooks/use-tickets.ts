'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { useUnitStore } from '@/shared/store/unit-store'
import { toast } from '@/shared/hooks/use-toast'
import { getErrorMessage } from '@/shared/lib/get-error-message'
import type { Ticket, TicketStatus, CreateTicketDto, UpdateTicketDto } from '@mediall/types'

function base(unitId: string) {
  return `/units/${unitId}/tickets`
}

export function useTickets(status?: TicketStatus) {
  const { activeUnit } = useUnitStore()
  const params = status ? `?status=${status}` : ''
  return useQuery({
    queryKey: ['tickets', activeUnit?.id, status ?? 'all'],
    queryFn: async () => {
      const res = await api.get<{ data: Ticket[] }>(`${base(activeUnit!.id)}${params}`)
      return res.data.data
    },
    enabled: !!activeUnit?.id,
  })
}

export function useTicket(ticketId: string) {
  const { activeUnit } = useUnitStore()
  return useQuery({
    queryKey: ['ticket', activeUnit?.id, ticketId],
    queryFn: async () => {
      const res = await api.get<{ data: Ticket }>(`${base(activeUnit!.id)}/${ticketId}`)
      return res.data.data
    },
    enabled: !!activeUnit?.id && !!ticketId,
  })
}

export function useTicketStats() {
  const { activeUnit } = useUnitStore()
  return useQuery({
    queryKey: ['ticket-stats', activeUnit?.id],
    queryFn: async () => {
      const res = await api.get<{ data: { open: number; inProgress: number; resolved: number; critical: number } }>(
        `${base(activeUnit!.id)}/stats`,
      )
      return res.data.data
    },
    enabled: !!activeUnit?.id,
  })
}

export function useCreateTicket() {
  const { activeUnit } = useUnitStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dto: CreateTicketDto) => {
      const res = await api.post(base(activeUnit!.id), dto)
      return res.data.data as Ticket
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets', activeUnit?.id] })
      qc.invalidateQueries({ queryKey: ['ticket-stats', activeUnit?.id] })
      toast.success('Chamado criado com sucesso')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useUpdateTicket() {
  const { activeUnit } = useUnitStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, dto }: { ticketId: string; dto: UpdateTicketDto }) => {
      const res = await api.patch(`${base(activeUnit!.id)}/${ticketId}`, dto)
      return res.data.data as Ticket
    },
    onSuccess: (_, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ['tickets', activeUnit?.id] })
      qc.invalidateQueries({ queryKey: ['ticket', activeUnit?.id, ticketId] })
      qc.invalidateQueries({ queryKey: ['ticket-stats', activeUnit?.id] })
      toast.success('Chamado atualizado')
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}

export function useAddTicketComment() {
  const { activeUnit } = useUnitStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, content, isInternal }: { ticketId: string; content: string; isInternal?: boolean }) => {
      const res = await api.post(`${base(activeUnit!.id)}/${ticketId}/comments`, { content, isInternal })
      return res.data.data
    },
    onSuccess: (_, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ['ticket', activeUnit?.id, ticketId] })
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  })
}
