import { Children, cloneElement, isValidElement, useId } from 'react'
import type { FieldError } from 'react-hook-form'

interface FormFieldProps {
  label: string
  error?: FieldError
  children: React.ReactNode
  required?: boolean
}

export function FormField({ label, error, children, required }: FormFieldProps) {
  const fieldId = useId()
  const errorId = `${fieldId}-error`

  // Wire the label to the single control and surface the error to AT.
  const child = Children.only(children)
  const controlId =
    (isValidElement(child) && (child.props as { id?: string }).id) || fieldId
  const control = isValidElement(child)
    ? cloneElement(child as React.ReactElement, {
        id: controlId,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error ? errorId : undefined,
      })
    : child

  return (
    <div>
      <label htmlFor={controlId} className="block text-sm font-medium text-gd mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {control}
      {error && (
        <p id={errorId} className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <i className="ti ti-alert-circle text-[12px]" aria-hidden="true" />
          {error.message}
        </p>
      )}
    </div>
  )
}
