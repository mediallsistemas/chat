'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select, Textarea } from '@/components/ui'
import { useUpdateGoal } from '@/hooks/use-strategic'
import { Direction, CalcMethod } from '@mediall/types'
import type { Goal } from '@mediall/types'

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
  goal: Pick<Goal, 'id' | 'title' | 'description' | 'direction' | 'calcMethod' | 'targetValue' | 'initialValue' | 'investment'>
}

export function EditGoalModal({ open, onClose, unitId, objectiveId, goal }: Props) {
  const { mutate, isPending } = useUpdateGoal(unitId, objectiveId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (open) {
      reset({
        title: goal.title,
        description: goal.description ?? '',
        direction: goal.direction as Direction,
        calcMethod: goal.calcMethod as CalcMethod,
      })
    }
  }, [open, goal, reset])

  function onSubmit(data: FormData) {
    const raw = data as unknown as RawValues
    mutate(
      {
        goalId: goal.id,
        dto: {
          ...data,
          targetValue: isNaN(raw.targetValue) ? undefined : raw.targetValue,
          initialValue: isNaN(raw.initialValue) ? undefined : raw.initialValue,
          investment: isNaN(raw.investment) ? undefined : raw.investment,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar meta" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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

        <div className="grid grid-cols-2 gap-3">
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

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Valor inicial"
            type="number"
            placeholder={String(goal.initialValue ?? 0)}
            {...register('initialValue' as keyof FormData, { valueAsNumber: true })}
          />
          <Input
            label="Valor alvo"
            type="number"
            placeholder={String(goal.targetValue ?? 100)}
            {...register('targetValue' as keyof FormData, { valueAsNumber: true })}
          />
        </div>

        <Input
          label="Investimento (R$)"
          type="number"
          step="0.01"
          placeholder={String(goal.investment ?? '0,00')}
          {...register('investment' as keyof FormData, { valueAsNumber: true })}
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
