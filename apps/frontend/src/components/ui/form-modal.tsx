'use client'

import { FormEvent } from 'react'
import { Modal } from './modal'
import { Button } from './button'

interface FormModalProps {
  open: boolean
  onClose: () => void
  title: string
  /**
   * The submit handler. Receives the native FormEvent so the caller can
   * still control validation if needed. With react-hook-form, prefer to
   * pass `form.handleSubmit(onValid)` here.
   */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>
  /** True while the submit mutation is in flight — disables submit button. */
  isPending?: boolean
  submitLabel?: string
  cancelLabel?: string
  /** Hide the cancel button (rare — useful for confirm-only flows). */
  hideCancel?: boolean
  /** Variant of the submit button — defaults to primary. */
  submitVariant?: 'primary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  /**
   * Disable submission (form invalid, etc). Distinct from `isPending` so the
   * spinner doesn't show but the button stays disabled.
   */
  submitDisabled?: boolean
  children: React.ReactNode
}

/**
 * Modal pre-wired with a <form> + submit/cancel footer. Replaces ~15 ad-hoc
 * implementations across the app (plano 16, item #18). Use with react-hook-form:
 *
 *   <FormModal
 *     open={open}
 *     onClose={close}
 *     title="Criar chamado"
 *     onSubmit={form.handleSubmit(onValid)}
 *     isPending={mutation.isPending}
 *   >
 *     <Input {...form.register('title')} />
 *     {form.formState.errors.title && <span>{form.formState.errors.title.message}</span>}
 *   </FormModal>
 */
export function FormModal({
  open,
  onClose,
  title,
  onSubmit,
  isPending = false,
  submitLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  hideCancel = false,
  submitVariant = 'primary',
  size = 'md',
  submitDisabled = false,
  children,
}: FormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size={size}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(e)
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-4">{children}</div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-gs/40">
          {!hideCancel && (
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              {cancelLabel}
            </Button>
          )}
          <Button
            type="submit"
            variant={submitVariant}
            loading={isPending}
            disabled={isPending || submitDisabled}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
