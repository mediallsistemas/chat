import { clsx } from 'clsx'
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors font-sora',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-gn text-gd hover:bg-[#aad63a] active:bg-[#9bc435]': variant === 'primary',
          'bg-page-bg text-gray-700 border border-gs hover:bg-gs/50': variant === 'secondary',
          'text-gray-600 hover:bg-page-bg hover:text-gray-900': variant === 'ghost',
          'bg-red-500 text-white hover:bg-red-600 active:bg-red-700': variant === 'danger',
        },
        {
          'text-xs px-3 py-1.5 h-8': size === 'sm',
          'text-sm px-4 py-2 h-9': size === 'md',
          'text-sm px-5 py-2.5 h-11': size === 'lg',
        },
        className,
      )}
      {...props}
    >
      {loading && (
        <i className="ti ti-loader-2 animate-spin text-base" aria-hidden="true" />
      )}
      {children}
    </button>
  )
}
