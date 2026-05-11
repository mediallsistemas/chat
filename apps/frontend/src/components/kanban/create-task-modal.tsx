'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select, Textarea } from '@/components/ui'
import { useCreateTask } from '@/hooks/use-kanban'
import { Priority } from '@mediall/types'

const schema = z.object({
  title: z.string().min(2, 'Título deve ter ao menos 2 caracteres'),
  description: z.string().optional(),
  responsibleUserId: z.string().uuid('ID do responsável inválido'),
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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: Priority.MEDIUM },
  })

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
    <Modal open={open} onClose={handleClose} title="Nova tarefa" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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

        <Input
          label="ID do responsável *"
          placeholder="UUID do usuário responsável"
          error={errors.responsibleUserId?.message}
          {...register('responsibleUserId')}
        />

        <Select label="Prioridade" {...register('priority')}>
          <option value="LOW">Baixa</option>
          <option value="MEDIUM">Média</option>
          <option value="HIGH">Alta</option>
          <option value="URGENT">Urgente</option>
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Data de início" type="date" {...register('startDate')} />
          <Input label="Prazo" type="date" {...register('dueDate')} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gs">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            Criar tarefa
          </Button>
        </div>
      </form>
    </Modal>
  )
}
