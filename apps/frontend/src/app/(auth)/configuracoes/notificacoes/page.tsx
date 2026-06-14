'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { clsx } from 'clsx'
import { useNotificationSettings } from '@/features/notifications/hooks/use-notification-settings'
import { usePushSubscription } from '@/features/notifications/hooks/use-push-subscription'
import { NotificationType } from '@mediall/types'
import type { NotificationSetting } from '@mediall/types'

const EMAIL_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.TASK_ASSIGNED]:        'Tarefa atribuída a mim',
  [NotificationType.TASK_OVERDUE]:         'Tarefa vencida',
  [NotificationType.TASK_DUE_SOON]:        'Tarefa vencendo em 48h',
  [NotificationType.IMPEDIMENT_CREATED]:   'Impedimento criado no setor',
  [NotificationType.IMPEDIMENT_ESCALATED]: 'Impedimento escalonado',
  [NotificationType.IMPEDIMENT_RESOLVED]:  'Impedimento resolvido',
  [NotificationType.PHASE_UNLOCKED]:       'Nova etapa desbloqueada',
  [NotificationType.PHASE_COMPLETED]:      'Etapa concluída',
  [NotificationType.MENTION]:              'Menção direta (@nome)',
  [NotificationType.MEETING_REMINDER]:     'Lembrete de reunião',
  [NotificationType.CHECKIN_REQUEST]:      'Check-in periódico de tarefa',
  [NotificationType.GOAL_AT_RISK]:         'Meta com progresso abaixo do esperado',
  [NotificationType.TRANSCRIPT_READY]:     'Transcrição de reunião pronta',
  [NotificationType.TICKET_ASSIGNED]:      'Chamado atribuído a mim',
  [NotificationType.TICKET_UPDATED]:       'Atualização em chamado meu',
}

interface SettingsForm {
  dndEnabled: boolean
  dndStart: string
  dndEnd: string
  emailEnabled: boolean
  emailTypes: NotificationType[]
  pushEnabled: boolean
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gd',
        checked ? 'bg-gd' : 'bg-gray-200',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gs p-6">
      <h2 className="text-sm font-semibold text-gray-800 font-sora mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gs/40 last:border-0">
      <div>
        <p className="text-sm text-gray-800">{label}</p>
        {description && <p className="text-xs text-gx mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export default function NotificacoesPage() {
  const { settings, isLoading, isSaving, updateSettings } = useNotificationSettings()
  const { isSupported, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushSubscription()

  const { control, watch, reset, handleSubmit } = useForm<SettingsForm>({
    defaultValues: {
      dndEnabled: false,
      dndStart: '22:00',
      dndEnd: '08:00',
      emailEnabled: true,
      emailTypes: [
        NotificationType.TASK_ASSIGNED,
        NotificationType.TASK_OVERDUE,
        NotificationType.IMPEDIMENT_ESCALATED,
        NotificationType.PHASE_UNLOCKED,
        NotificationType.MEETING_REMINDER,
      ],
      pushEnabled: true,
    },
  })

  useEffect(() => {
    if (settings) {
      reset({
        dndEnabled: settings.dndEnabled,
        dndStart: settings.dndStart ?? '22:00',
        dndEnd: settings.dndEnd ?? '08:00',
        emailEnabled: settings.emailEnabled,
        emailTypes: (settings.emailTypes as NotificationType[]) ?? [],
        pushEnabled: settings.pushEnabled,
      })
    }
  }, [settings, reset])

  const dndEnabled = watch('dndEnabled')
  const emailEnabled = watch('emailEnabled')

  const onSubmit = (data: SettingsForm) => {
    updateSettings(data as Partial<NotificationSetting>)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <span className="text-sm text-gx">Carregando…</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-sora">Notificações</h1>
          <p className="text-sm text-gx mt-1">Configure como e quando você recebe alertas.</p>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 bg-gd text-white text-sm font-semibold rounded-xl hover:bg-gd/90 transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>

      {/* Do Not Disturb */}
      <SectionCard title="Modo Não Perturbe">
        <Row label="Ativar modo não perturbe" description="Silencia e-mails e push durante o horário configurado">
          <Controller
            control={control}
            name="dndEnabled"
            render={({ field }) => (
              <Toggle checked={field.value} onChange={field.onChange} />
            )}
          />
        </Row>

        {dndEnabled && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gs/40">
            <div className="flex-1">
              <label className="text-xs text-gx font-medium block mb-1">Início</label>
              <Controller
                control={control}
                name="dndStart"
                render={({ field }) => (
                  <input
                    type="time"
                    {...field}
                    className="w-full border border-gs rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gd"
                  />
                )}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gx font-medium block mb-1">Fim</label>
              <Controller
                control={control}
                name="dndEnd"
                render={({ field }) => (
                  <input
                    type="time"
                    {...field}
                    className="w-full border border-gs rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gd"
                  />
                )}
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Push Notifications */}
      <SectionCard title="Notificações Push (PWA)">
        <Row
          label="Receber notificações push"
          description={
            !isSupported
              ? 'Navegador não suportado'
              : isSubscribed
              ? 'Ativo neste dispositivo'
              : 'Não ativado neste dispositivo'
          }
        >
          <Controller
            control={control}
            name="pushEnabled"
            render={({ field }) => (
              <Toggle checked={field.value} onChange={field.onChange} />
            )}
          />
        </Row>

        {isSupported && (
          <div className="mt-3 pt-3 border-t border-gs/40">
            {isSubscribed ? (
              <button
                type="button"
                onClick={unsubscribe}
                disabled={pushLoading}
                className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
              >
                {pushLoading ? 'Processando…' : 'Cancelar push neste dispositivo'}
              </button>
            ) : (
              <button
                type="button"
                onClick={subscribe}
                disabled={pushLoading}
                className="text-xs text-gd hover:text-gd/80 font-medium transition-colors disabled:opacity-50"
              >
                {pushLoading ? 'Processando…' : 'Ativar push neste dispositivo'}
              </button>
            )}
          </div>
        )}
      </SectionCard>

      {/* Email Notifications */}
      <SectionCard title="Notificações por E-mail">
        <Row label="Receber notificações por e-mail" description="E-mails para eventos críticos">
          <Controller
            control={control}
            name="emailEnabled"
            render={({ field }) => (
              <Toggle checked={field.value} onChange={field.onChange} />
            )}
          />
        </Row>

        {emailEnabled && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gx font-medium mb-2 pt-2 border-t border-gs/40">Quais eventos enviar por e-mail:</p>
            <Controller
              control={control}
              name="emailTypes"
              render={({ field }) => (
                <>
                  {(Object.values(NotificationType) as NotificationType[]).map((type) => (
                    <label key={type} className="flex items-center gap-3 py-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={field.value.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            field.onChange([...field.value, type])
                          } else {
                            field.onChange(field.value.filter((t) => t !== type))
                          }
                        }}
                        className="w-4 h-4 rounded border-gs text-gd focus:ring-gd"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                        {EMAIL_TYPE_LABELS[type]}
                      </span>
                    </label>
                  ))}
                </>
              )}
            />
          </div>
        )}
      </SectionCard>
    </form>
  )
}
