'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select, Textarea } from '@/components/ui'
import { useCreatePhase } from '@/hooks/use-strategic'
import { UnitScope } from '@mediall/types'

const schema = z.object({
  title: z.string().min(3, 'Título deve ter ao menos 3 caracteres'),
  description: z.string().optional(),
  order: z.number().int().min(1, 'Ordem mínima é 1'),
  responsibleUserId: z.string().uuid('ID do responsável inválido'),
  unitScope: z.nativeEnum(UnitScope).optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  unitId: string
  goalId: string
  nextOrder: number
}

export function CreatePhaseModal({ open, onClose, unitId, goalId, nextOrder }: Props) {
  const { mutate, isPending } = useCreatePhase(unitId, goalId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { order: nextOrder, unitScope: UnitScope.ALL },
  })

  function onSubmit(data: FormData) {
    mutate(data, {
      onSuccess: () => {
        reset()
        onClose()
      },
    })
  }

  function handleClose() {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nova etapa" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Título da etapa *"
          placeholder="Ex: Diagnóstico"
          error={errors.title?.message}
          {...register('title')}
        />

        <Textarea
          label="Descrição"
          placeholder="Descreva esta etapa..."
          {...register('description')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Ordem *"
            type="number"
            error={errors.order?.message}
            {...register('order', { valueAsNumber: true })}
          />

          <Select label="Escopo de unidade" {...register('unitScope')}>
            <option value={UnitScope.ALL}>Todas as unidades</option>
            <option value={UnitScope.SPECIFIC}>Unidade específica</option>
            <option value={UnitScope.MATRIX}>Matriz</option>
          </Select>
        </div>

        <Input
          label="ID do responsável *"
          placeholder="UUID do usuário responsável"
          error={errors.responsibleUserId?.message}
          {...register('responsibleUserId')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Data de início"
            type="date"
            {...register('startDate')}
          />
          <Input
            label="Prazo"
            type="date"
            {...register('dueDate')}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gs">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            Criar etapa
          </Button>
        </div>
      </form>
    </Modal>
  )
}
