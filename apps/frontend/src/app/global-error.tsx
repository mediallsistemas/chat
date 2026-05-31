'use client'

import { useEffect } from 'react'

// Catches errors thrown in the root layout itself, where the normal
// error.tsx boundaries don't apply. Must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            textAlign: 'center',
            padding: 24,
            color: '#1f2937',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Algo deu errado</h1>
          <p style={{ fontSize: 14, color: '#6b7280', maxWidth: 360 }}>
            Ocorreu um erro inesperado. Tente recarregar a página. Se persistir, contate o suporte.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>
              Código do erro: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
