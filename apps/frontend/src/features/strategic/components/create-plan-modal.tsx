'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Textarea } from '@/shared/components/ui'
import { useCreatePlan } from '@/features/strategic/hooks/use-strategic'

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
}

export function CreatePlanModal({ open, onClose, unitId }: Props) {
  const { mutate, isPending } = useCreatePlan(unitId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { year: new Date().getFullYear() },
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
    <Modal
      open={open}
      onClose={handleClose}
      title="Novo plano estratégico"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="create-plan-form" loading={isPending}>
            Criar plano
          </Button>
        </>
      }
    >
      <form id="create-plan-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
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
      </form>
    </Modal>
  )
}
