'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Textarea } from '@/components/ui'
import { useUpdateObjective } from '@/hooks/use-strategic'
import type { Objective } from '@mediall/types'

const schema = z.object({
  title: z.string().min(3, 'Título deve ter ao menos 3 caracteres'),
  description: z.string().optional(),
  benefits: z.string().optional(),
  responsibleUserId: z.string().uuid('ID do responsável inválido'),
  deadline: z.string().min(1, 'Informe o prazo'),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  unitId: string
  planId: string
  objective: Pick<Objective, 'id' | 'title' | 'description' | 'benefits' | 'responsibleUserId' | 'deadline'>
}

export function EditObjectiveModal({ open, onClose, unitId, planId, objective }: Props) {
  const { mutate, isPending } = useUpdateObjective(unitId, planId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (open) {
      reset({
        title: objective.title,
        description: objective.description ?? '',
        benefits: objective.benefits ?? '',
        responsibleUserId: objective.responsibleUserId ?? '',
        deadline: objective.deadline
          ? new Date(objective.deadline).toISOString().split('T')[0]
          : '',
      })
    }
  }, [open, objective, reset])

  function onSubmit(data: FormData) {
    mutate(
      { objectiveId: objective.id, dto: data },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar objetivo" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Título do objetivo *"
          placeholder="Ex: Reduzir tempo médio de atendimento"
          error={errors.title?.message}
          {...register('title')}
        />

        <Textarea
          label="Descrição"
          placeholder="Descreva o objetivo..."
          {...register('description')}
        />

        <Textarea
          label="Benefícios esperados"
          placeholder="Quais benefícios este objetivo trará?"
          {...register('benefits')}
        />

        <Input
          label="ID do responsável *"
          placeholder="UUID do usuário responsável"
          error={errors.responsibleUserId?.message}
          {...register('responsibleUserId')}
        />

        <Input
          label="Prazo *"
          type="date"
          error={errors.deadline?.message}
          {...register('deadline')}
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-gs">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
