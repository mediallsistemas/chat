'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Textarea } from '@/components/ui'
import { useUpdatePlan } from '@/hooks/use-strategic'
import type { Plan } from '@mediall/types'

const schema = z.object({
  name: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  year: z.number().int().min(2020, 'Ano mínimo é 2020').max(2100, 'Ano máximo é 2100'),
  vision: z.string().optional(),
  mission: z.string().optional(),
  values: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  unitId: string
  plan: Pick<Plan, 'id' | 'name' | 'year' | 'vision' | 'mission' | 'values'>
}

export function EditPlanModal({ open, onClose, unitId, plan }: Props) {
  const { mutate, isPending } = useUpdatePlan(unitId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (open) {
      reset({
        name: plan.name,
        year: plan.year,
        vision: plan.vision ?? '',
        mission: plan.mission ?? '',
        values: plan.values ?? '',
      })
    }
  }, [open, plan, reset])

  function onSubmit(data: FormData) {
    mutate(
      { planId: plan.id, dto: data },
      {
        onSuccess: () => {
          onClose()
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar plano estratégico" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label="Nome do plano *"
          placeholder="Ex: Eficiência Operacional 2026"
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Ano *"
          type="number"
          placeholder="2026"
          error={errors.year?.message}
          {...register('year', { valueAsNumber: true })}
        />

        <Textarea
          label="Visão"
          placeholder="Qual é a visão de futuro deste plano?"
          {...register('vision')}
        />

        <Textarea
          label="Missão"
          placeholder="Qual é a missão associada?"
          {...register('mission')}
        />

        <Textarea
          label="Valores"
          placeholder="Quais valores norteiam este plano?"
          {...register('values')}
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
