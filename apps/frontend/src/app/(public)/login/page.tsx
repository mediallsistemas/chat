'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'
import { LoginResponse } from '@mediall/types'

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: LoginResponse }>('/auth/login', { email, password })
      return res.data.data
    },
    onSuccess: (data) => {
      setUser(data.user)
      router.push('/dashboard')
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'E-mail ou senha inválidos.')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    mutate()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--gd)' }}
    >
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 48px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 48px)',
        }}
      />

      <div className="relative w-full max-w-sm mx-4">
        {/* Logo / brand */}
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-4"
            style={{ backgroundColor: 'var(--gn)' }}
          >
            <i className="ti ti-building-hospital text-2xl" style={{ color: 'var(--gd)' }} />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight text-white"
            style={{ fontFamily: 'var(--font-sora)' }}
          >
            Mediall Brasil
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Plataforma Corporativa Interna
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="seu@email.com"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gn)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'rgba(255,255,255,0.55)' }}
              >
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gn)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>

            {error && (
              <div
                className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}
              >
                <i className="ti ti-alert-circle text-base" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                backgroundColor: 'var(--gn)',
                color: 'var(--gd)',
                fontFamily: 'var(--font-sora)',
              }}
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ti ti-loader-2 animate-spin text-base" />
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.25)' }}>
          © {new Date().getFullYear()} Mediall Brasil
        </p>
      </div>
    </div>
  )
}
