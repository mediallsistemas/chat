'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function AuthError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-24">
      <i className="ti ti-alert-circle text-5xl text-red-400 opacity-60" aria-hidden="true" />
      <div>
        <p className="text-base font-semibold text-gd">Algo deu errado</p>
        <p className="text-sm text-gs mt-1 max-w-xs">
          Ocorreu um erro inesperado. Se o problema persistir, entre em contato com o suporte.
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={reset}>
        <i className="ti ti-refresh mr-1" aria-hidden="true" />
        Tentar novamente
      </Button>
    </div>
  )
}
