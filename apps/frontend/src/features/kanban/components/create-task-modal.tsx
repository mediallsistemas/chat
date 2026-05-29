'use client'

import { useForm, useController } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select, Textarea, UserCombobox } from '@/shared/components/ui'
import { useCreateTask } from '@/features/kanban/hooks/use-kanban'
import { useUnitMembers } from '@/features/users/hooks/use-users'
import { Priority } from '@mediall/types'

const schema = z.object({
  title: z.string().min(2, 'Título deve ter ao menos 2 caracteres'),
  description: z.string().optional(),
  responsibleUserId: z.string().uuid('Selecione o responsável'),
  priority: z.nativeEnum(Priority),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  unitId: string
  boardId: string
  columnId: string
}

export function CreateTaskModal({ open, onClose, unitId, boardId, columnId }: Props) {
  const { mutate, isPending } = useCreateTask(unitId)
  const { data: members = [], isLoading: membersLoading } = useUnitMembers(unitId)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: Priority.MEDIUM },
  })

  const { field: responsibleField } = useController({ name: 'responsibleUserId', control })

  function onSubmit(data: FormData) {
    mutate(
      { ...data, boardId, columnId },
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
      title="Nova tarefa"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="create-task-form" loading={isPending}>
            Criar tarefa
          </Button>
        </>
      }
    >
      <form id="create-task-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Input
          label="Título *"
          placeholder="Descreva a tarefa..."
          error={errors.title?.message}
          {...register('title')}
        />

        <Textarea
          label="Descrição / critério de conclusão"
          placeholder="O que precisa estar feito para esta tarefa ser concluída?"
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

        <Select label="Prioridade" {...register('priority')}>
          <option value="LOW">Baixa</option>
          <option value="MEDIUM">Média</option>
          <option value="HIGH">Alta</option>
          <option value="URGENT">Urgente</option>
        </Select>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Data de início" type="date" {...register('startDate')} />
          <Input label="Prazo" type="date" {...register('dueDate')} />
        </div>
      </form>
    </Modal>
  )
}
