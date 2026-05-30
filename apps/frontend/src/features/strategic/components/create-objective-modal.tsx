'use client'

import { useForm, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Textarea, UserCombobox } from '@/shared/components/ui'
import { useCreateObjective } from '@/features/strategic/hooks/use-strategic'
import { useUnitMembers } from '@/features/users/hooks/use-users'

const schema = z.object({
  title: z.string().min(3, 'Título deve ter ao menos 3 caracteres'),
  description: z.string().optional(),
  benefits: z.string().optional(),
  responsibleUserId: z.string().uuid('Selecione o responsável'),
  deadline: z.string().min(1, 'Informe o prazo'),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  unitId: string
  planId: string
}

export function CreateObjectiveModal({ open, onClose, unitId, planId }: Props) {
  const { mutate, isPending } = useCreateObjective(unitId, planId)
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
      title="Novo objetivo"
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="create-objective-form" loading={isPending}>
            Criar objetivo
          </Button>
        </>
      }
    >
      <form id="create-objective-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
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

        <UserCombobox
          label="Responsável *"
          value={responsibleField.value ?? ''}
          onChange={responsibleField.onChange}
          users={members}
          loading={membersLoading}
          error={errors.responsibleUserId?.message}
        />

        <Input
          label="Prazo *"
          type="date"
          error={errors.deadline?.message}
          {...register('deadline')}
        />
      </form>
    </Modal>
  )
}
