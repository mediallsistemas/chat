import type { FieldError } from 'react-hook-form'

interface FormFieldProps {
  label: string
  error?: FieldError
  children: React.ReactNode
  required?: boolean
}

export function FormField({ label, error, children, required }: FormFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gd mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <i className="ti ti-alert-circle text-[12px]" aria-hidden="true" />
          {error.message}
        </p>
      )}
    </div>
  )
}
