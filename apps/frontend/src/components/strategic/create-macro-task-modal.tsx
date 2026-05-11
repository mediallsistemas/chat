'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Textarea } from '@/components/ui'
import { useCreateMacroTask } from '@/hooks/use-strategic'

const schema = z.object({
  title: z.string().min(3, 'Título deve ter ao menos 3 caracteres'),
  description: z.string().optional(),
  responsibleUserId: z.string().uuid('ID do responsável inválido'),
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

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
    <Modal open={open} onClose={handleClose} title="Nova macrotarefa" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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

        <Input
          label="ID do responsável *"
          placeholder="UUID do usuário responsável"
          error={errors.responsibleUserId?.message}
          {...register('responsibleUserId')}
        />

        <Input
          label="ID do setor"
          placeholder="UUID do setor (opcional)"
          error={errors.sectorId?.message}
          {...register('sectorId')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Data de início" type="date" {...register('startDate')} />
          <Input label="Prazo" type="date" {...register('dueDate')} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gs">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            Criar macrotarefa
          </Button>
        </div>
      </form>
    </Modal>
  )
}
