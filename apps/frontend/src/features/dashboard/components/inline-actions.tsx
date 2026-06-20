'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, FormModal, FormField, Textarea, Modal } from '@/shared/components/ui'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { UserRole } from '@mediall/types'
import { useResolveImpedimentAction, useArchivePlanAction, useDeletePlanAction } from '../hooks/use-dashboard-actions'

/**
 * Inline actions for the Jarvis panel (plano 25.5). RBAC mirrors the backend
 * `@Roles` so the controls only appear for roles that can actually use them —
 * but the guard stack remains the source of truth (`security.md` §4, `ui.md` §9).
 */
function useHasRole(...roles: UserRole[]): boolean {
  const role = useAuthStore((s) => s.user?.role)
  return !!role && roles.includes(role)
}

// ─── Resolve impediment ─────────────────────────────────────────────────────

const resolveSchema = z.object({
  resolutionNotes: z
    .string()
    .trim()
    .min(3, 'Descreva como o impedimento foi resolvido (mín. 3 caracteres).'),
})
type ResolveForm = z.infer<typeof resolveSchema>

interface ResolveImpedimentButtonProps {
  unitId: string
  impedimentId: string
  taskTitle: string
}

export function ResolveImpedimentButton({ unitId, impedimentId, taskTitle }: ResolveImpedimentButtonProps) {
  const canResolve = useHasRole(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  const [open, setOpen] = useState(false)
  const { mutate, isPending } = useResolveImpedimentAction()

  const form = useForm<ResolveForm>({
    resolver: zodResolver(resolveSchema),
    defaultValues: { resolutionNotes: '' },
  })

  if (!canResolve) return null

  function onValid(values: ResolveForm) {
    mutate(
      { unitId, impedimentId, resolutionNotes: values.resolutionNotes },
      {
        onSuccess: () => {
          setOpen(false)
          form.reset()
        },
      },
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Resolver impedimento de ${taskTitle}`}
      >
        <i className="ti ti-circle-check mr-1" aria-hidden="true" />
        Resolver
      </Button>

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        title="Resolver impedimento"
        size="sm"
        submitLabel="Marcar como resolvido"
        isPending={isPending}
        onSubmit={form.handleSubmit(onValid)}
      >
        <p className="text-sm text-gx">
          Tarefa: <span className="font-medium text-gray-700">{taskTitle}</span>
        </p>
        <FormField label="Como foi resolvido?" required error={form.formState.errors.resolutionNotes}>
          <Textarea
            {...form.register('resolutionNotes')}
            rows={3}
            placeholder="Descreva a resolução..."
            autoFocus
          />
        </FormField>
      </FormModal>
    </>
  )
}

// ─── Archive plan ────────────────────────────────────────────────────────────

interface ArchivePlanButtonProps {
  unitId: string
  planId: string
  planName: string
}

export function ArchivePlanButton({ unitId, planId, planName }: ArchivePlanButtonProps) {
  const canManage = useHasRole(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  const [open, setOpen] = useState(false)
  const { mutate, isPending } = useArchivePlanAction()

  if (!canManage) return null

  function confirmArchive() {
    mutate({ unitId, planId }, { onSuccess: () => setOpen(false) })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Arquivar plano ${planName}`}
      >
        <i className="ti ti-archive mr-1" aria-hidden="true" />
        Arquivar
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Arquivar plano"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmArchive} loading={isPending}>
              Arquivar
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Arquivar o plano <span className="font-semibold text-gd">{planName}</span>? Ele sai da
          visão ativa e seus boards são arquivados. Você pode reativá-lo depois.
        </p>
      </Modal>
    </>
  )
}

// ─── Excluir plano (geral) ────────────────────────────────────────────────────

interface DeletePlanButtonProps {
  planId: string
  planName: string
}

export function DeletePlanButton({ planId, planName }: DeletePlanButtonProps) {
  const canManage = useHasRole(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  const [open, setOpen] = useState(false)
  const { mutate, isPending } = useDeletePlanAction()

  if (!canManage) return null

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`Excluir plano ${planName}`}
      >
        <i className="ti ti-trash mr-1" aria-hidden="true" />
        Excluir
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Excluir plano"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => mutate({ planId }, { onSuccess: () => setOpen(false) })}
              loading={isPending}
            >
              Excluir plano
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          Excluir o plano <span className="font-semibold text-gd">{planName}</span> de{' '}
          <span className="font-semibold">todas as unidades</span>? O plano sai da holding inteira.
        </p>
      </Modal>
    </>
  )
}
