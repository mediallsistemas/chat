'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select, Textarea } from '@/shared/components/ui'
import { useCreateGoal } from '@/features/strategic/hooks/use-strategic'
import { Direction, CalcMethod } from '@mediall/types'

const schema = z.object({
  title: z.string().min(3, 'Título deve ter ao menos 3 caracteres'),
  description: z.string().optional(),
  direction: z.nativeEnum(Direction),
  calcMethod: z.nativeEnum(CalcMethod),
})

type FormData = z.infer<typeof schema>

interface RawValues extends FormData {
  targetValue: number
  initialValue: number
  investment: number
}

interface Props {
  open: boolean
  onClose: () => void
  unitId: string
  objectiveId: string
}

export function CreateGoalModal({ open, onClose, unitId, objectiveId }: Props) {
  const { mutate, isPending } = useCreateGoal(unitId, objectiveId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { direction: Direction.UP, calcMethod: CalcMethod.PERCENTAGE },
  })

  function onSubmit(data: FormData) {
    const raw = data as unknown as RawValues
    mutate(
      {
        ...data,
        targetValue: isNaN(raw.targetValue) ? undefined : raw.targetValue,
        initialValue: isNaN(raw.initialValue) ? undefined : raw.initialValue,
        investment: isNaN(raw.investment) ? undefined : raw.investment,
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
      title="Nova meta"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="create-goal-form" loading={isPending}>
            Criar meta
          </Button>
        </>
      }
    >
      <form id="create-goal-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Input
          label="Título da meta *"
          placeholder="Ex: Triagem em menos de 10 minutos"
          error={errors.title?.message}
          {...register('title')}
        />

        <Textarea
          label="Descrição"
          placeholder="Descreva a meta..."
          {...register('description')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Direção *" error={errors.direction?.message} {...register('direction')}>
            <option value={Direction.UP}>Crescente (↑)</option>
            <option value={Direction.DOWN}>Decrescente (↓)</option>
          </Select>

          <Select label="Método de cálculo *" error={errors.calcMethod?.message} {...register('calcMethod')}>
            <option value={CalcMethod.PERCENTAGE}>Percentual</option>
            <option value={CalcMethod.SUM}>Somatório</option>
            <option value={CalcMethod.BINARY}>Binário</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Valor inicial"
            type="number"
            placeholder="0"
            {...register('initialValue' as keyof FormData, { valueAsNumber: true })}
          />
          <Input
            label="Valor alvo"
            type="number"
            placeholder="100"
            {...register('targetValue' as keyof FormData, { valueAsNumber: true })}
          />
        </div>

        <Input
          label="Investimento (R$)"
          type="number"
          step="0.01"
          placeholder="0,00"
          {...register('investment' as keyof FormData, { valueAsNumber: true })}
        />
      </form>
    </Modal>
  )
}
