'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { Modal, Button, Input, Textarea } from '@/shared/components/ui'
import {
  useUpdatePlan,
  usePlanUnits,
  useAttachPlanUnits,
  useDetachPlanUnit,
  useDeletePlan,
} from '@/features/strategic/hooks/use-strategic'
import { useUnits } from '@/features/units/hooks/use-units'
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

  // Plano 24 — unidades onde o plano vale
  const planUnitsQ = usePlanUnits(open ? plan.id : undefined)
  const { units: allUnits } = useUnits()
  const attach = useAttachPlanUnits(plan.id)
  const detach = useDetachPlanUnit(plan.id)
  const removePlan = useDeletePlan()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const attachedUnits = planUnitsQ.data ?? []
  const attachedIds = new Set(attachedUnits.map((pu) => pu.unitId))
  const availableUnits = (allUnits ?? []).filter((u) => !attachedIds.has(u.id))

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
      setSelected(new Set())
      setConfirmingDelete(false)
    }
  }, [open, plan, reset])

  function onSubmit(data: FormData) {
    mutate({ planId: plan.id, dto: data }, { onSuccess: () => onClose() })
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar plano estratégico"
      size="lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-plan-form" loading={isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <form id="edit-plan-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
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
        <Textarea label="Visão" placeholder="Qual é a visão de futuro deste plano?" {...register('vision')} />
        <Textarea label="Missão" placeholder="Qual é a missão associada?" {...register('mission')} />
        <Textarea label="Valores" placeholder="Quais valores norteiam este plano?" {...register('values')} />
      </form>

      {/* Plano 24 — Unidades onde o plano vale */}
      <section className="mt-6 border-t border-gs/40 pt-4">
        <h3 className="text-sm font-semibold text-gd font-sora mb-2">Unidades onde o plano vale</h3>

        {planUnitsQ.isLoading ? (
          <p className="text-xs text-gx">Carregando unidades…</p>
        ) : (
          <div className="space-y-1.5">
            {attachedUnits.map((pu) => (
              <div
                key={pu.id}
                className="flex items-center justify-between rounded-lg bg-page-bg px-3 py-2"
              >
                <span className="text-sm text-gray-800">{pu.unit.name}</span>
                <button
                  type="button"
                  onClick={() => detach.mutate(pu.unitId)}
                  disabled={attachedUnits.length <= 1 || detach.isPending}
                  className="p-1 text-gx hover:text-red-500 transition-colors disabled:opacity-40 disabled:hover:text-gx"
                  aria-label={`Remover plano da unidade ${pu.unit.name}`}
                  title={attachedUnits.length <= 1 ? 'Não é possível remover a última unidade' : 'Remover desta unidade'}
                >
                  <i className="ti ti-trash text-sm" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {availableUnits.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gx mb-1.5">Adicionar a outras unidades:</p>
            <div className="flex flex-wrap gap-1.5">
              {availableUnits.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleSelect(u.id)}
                  className={clsx(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    selected.has(u.id)
                      ? 'bg-gn text-gd border-gn'
                      : 'border-gs text-gx hover:border-gd hover:text-gd',
                  )}
                >
                  {u.name}
                </button>
              ))}
            </div>
            {selected.size > 0 && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-2"
                loading={attach.isPending}
                onClick={() => attach.mutate(Array.from(selected), { onSuccess: () => setSelected(new Set()) })}
              >
                <i className="ti ti-plus text-sm mr-1" aria-hidden="true" />
                Adicionar {selected.size} {selected.size === 1 ? 'unidade' : 'unidades'}
              </Button>
            )}
          </div>
        )}
      </section>

      {/* Danger zone — excluir plano (geral) */}
      <section className="mt-5 border-t border-gs/40 pt-4">
        {!confirmingDelete ? (
          <Button type="button" variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
            <i className="ti ti-trash text-sm mr-1" aria-hidden="true" />
            Excluir plano (todas as unidades)
          </Button>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-red-600">Excluir este plano de todas as unidades?</span>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={removePlan.isPending}
              onClick={() => removePlan.mutate(plan.id, { onSuccess: () => onClose() })}
            >
              Confirmar exclusão
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancelar
            </Button>
          </div>
        )}
      </section>
    </Modal>
  )
}
