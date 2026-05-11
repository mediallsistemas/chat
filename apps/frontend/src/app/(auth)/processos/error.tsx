'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ProcessosError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <i className="ti ti-alert-circle text-4xl text-red-400" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-gray-800">Algo deu errado</p>
        <p className="text-xs text-gx mt-1">Não foi possível carregar os planos estratégicos.</p>
      </div>
      <Button size="sm" variant="secondary" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  )
}
