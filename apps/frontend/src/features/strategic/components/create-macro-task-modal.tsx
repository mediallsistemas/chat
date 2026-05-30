'use client'

import { useForm, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Textarea, UserCombobox } from '@/shared/components/ui'
import { useCreateMacroTask } from '@/features/strategic/hooks/use-strategic'
import { useUnitMembers } from '@/features/users/hooks/use-users'

const schema = z.object({
  title: z.string().min(3, 'Título deve ter ao menos 3 caracteres'),
  description: z.string().optional(),
  responsibleUserId: z.string().uuid('Selecione o responsável'),
  sectorId: z.string().uuid('ID do setor inválido').optional().or(z.literal('')),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  unitId: string
  phaseId: string
}

export function CreateMacroTaskModal({ open, onClose, unitId, phaseId }: Props) {
  const { mutate, isPending } = useCreateMacroTask(unitId, phaseId)
  const { data: members = [], isLoading: membersLoading } = useUnitMembers(unitId)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const { field: responsibleField } = useController({ name: 'responsibleUserId', control })

  function onSubmit(data: FormData) {
    mutate(
      {
        ...data,
        sectorId: data.sectorId || undefined,
      },
      {
        onSuccess: () => {
          reset()
          onClose()
        },
      },
    )
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nova macrotarefa"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="create-macro-task-form" loading={isPending}>
            Criar macrotarefa
          </Button>
        </>
      }
    >
      <form id="create-macro-task-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Input
          label="Título *"
          placeholder="Ex: Diagnóstico de processos"
          error={errors.title?.message}
          {...register('title')}
        />

        <Textarea
          label="Descrição"
          placeholder="Descreva esta macrotarefa..."
          {...register('description')}
        />

        <UserCombobox
          label="Responsável *"
          value={responsibleField.value ?? ''}
          onChange={responsibleField.onChange}
          users={members}
          loading={membersLoading}
          error={errors.responsibleUserId?.message}
        />

        <Input
          label="ID do setor"
          placeholder="UUID do setor (opcional)"
          error={errors.sectorId?.message}
          {...register('sectorId')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Data de início" type="date" {...register('startDate')} />
          <Input label="Prazo" type="date" {...register('dueDate')} />
        </div>
      </form>
    </Modal>
  )
}
