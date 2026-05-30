'use client'

import { useEffect } from 'react'
import { Button } from '@/shared/components/ui'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ImpedimentosError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-24">
      <i className="ti ti-alert-triangle text-5xl text-gs opacity-30" aria-hidden="true" />
      <div>
        <p className="text-base font-semibold text-gd">Erro ao carregar Impedimentos</p>
        <p className="text-sm text-gs mt-1">Não foi possível carregar a lista de impedimentos.</p>
      </div>
      <Button size="sm" variant="secondary" onClick={reset}>
        <i className="ti ti-refresh mr-1" aria-hidden="true" />
        Tentar novamente
      </Button>
    </div>
  )
}
