'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { api, invalidateCsrfToken } from '@/shared/lib/api'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { LoginResponse } from '@mediall/types'

export default function SignupPage() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)
  const user = useAuthStore((s) => s.user)

  const [companyName, setCompanyName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  // Already authenticated → skip the signup form.
  useEffect(() => {
    if (user) router.replace('/dashboard')
  }, [user, router])

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: LoginResponse }>('/auth/signup', {
        companyName,
        name,
        email,
        password,
      })
      return res.data.data
    },
    onSuccess: (data) => {
      // Signing up establishes a session → the CSRF token bound to the anonymous
      // request is now stale. Drop it so the next mutation fetches a fresh one.
      invalidateCsrfToken()
      setUser(data.user)
      router.push('/dashboard')
    },
    onError: (err: any) => {
      const status = err.response?.status
      const apiMessage = err.response?.data?.message
      if (status === 409) {
        setError(apiMessage || 'Já existe uma conta com este e-mail.')
      } else if (status === 429) {
        setError('Muitas tentativas. Aguarde alguns instantes e tente novamente.')
      } else {
        setError(apiMessage || 'Não foi possível criar a conta. Tente novamente.')
      }
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    mutate()
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--wh)',
    border: '1px solid var(--gs)',
    color: '#1a1a1a',
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ─────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden flex-col justify-between p-12 xl:p-16"
        style={{ backgroundColor: 'var(--gd)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 1px,transparent 48px),repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 1px,transparent 48px)',
          }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full pointer-events-none"
          style={{ backgroundColor: 'var(--gn)', opacity: 0.12, filter: 'blur(80px)' }}
        />

        <div className="relative flex items-center gap-3">
          <div
            className="inline-flex items-center justify-center w-11 h-11 rounded-2xl"
            style={{ backgroundColor: 'var(--gn)' }}
          >
            <i className="ti ti-building-hospital text-2xl" style={{ color: 'var(--gd)' }} />
          </div>
          <span
            className="text-lg font-bold tracking-tight text-white"
            style={{ fontFamily: 'var(--font-sora)' }}
          >
            Mediall Brasil
          </span>
        </div>

        <div className="relative max-w-lg">
          <h1
            className="text-4xl xl:text-5xl font-bold leading-tight text-white"
            style={{ fontFamily: 'var(--font-sora)' }}
          >
            Comece grátis por
            <span style={{ color: 'var(--gn)' }}> 14 dias</span>.
          </h1>
          <p className="mt-6 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Crie a conta da sua organização e gerencie planos estratégicos, comunicação e tarefas de
            todas as unidades em um só lugar. Sem cartão de crédito.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              { icon: 'ti-rocket', text: 'Trial de 14 dias, sem cartão' },
              { icon: 'ti-building-community', text: 'Multi-unidade desde o primeiro dia' },
              { icon: 'ti-shield-lock', text: 'Seus dados isolados por organização' },
            ].map((item) => (
              <li key={item.icon} className="flex items-center gap-3">
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                  style={{ backgroundColor: 'rgba(191,239,69,0.15)' }}
                >
                  <i className={`ti ${item.icon} text-base`} style={{ color: 'var(--gn)' }} />
                </span>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
          © {new Date().getFullYear()} Mediall Brasil · Plataforma Corporativa
        </p>
      </div>

      {/* ── Right form panel ─────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12"
        style={{ backgroundColor: 'var(--bg)' }}
      >
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ backgroundColor: 'var(--gd)' }}
            >
              <i className="ti ti-building-hospital text-xl" style={{ color: 'var(--gn)' }} />
            </div>
            <span
              className="text-base font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-sora)', color: 'var(--gd)' }}
            >
              Mediall Brasil
            </span>
          </div>

          <h2
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-sora)', color: 'var(--gd)' }}
          >
            Criar conta da organização
          </h2>
          <p className="text-sm mt-1.5" style={{ color: 'var(--gx)' }}>
            Comece o trial gratuito de 14 dias.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'var(--gx)' }}
              >
                Nome da empresa
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                autoComplete="organization"
                placeholder="Sua Holding Ltda."
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gd)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--gs)')}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'var(--gx)' }}
              >
                Seu nome
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Maria Silva"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gd)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--gs)')}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'var(--gx)' }}
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
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gd)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--gs)')}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-2 uppercase tracking-wider"
                style={{ color: 'var(--gx)' }}
              >
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-xl px-4 py-3 pr-11 text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--gd)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--gs)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors"
                  style={{ color: 'var(--gx)' }}
                >
                  <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'} text-base`} aria-hidden="true" />
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
                style={{ backgroundColor: 'rgba(239,68,68,0.10)', color: '#b91c1c' }}
              >
                <i className="ti ti-alert-circle text-base shrink-0" aria-hidden="true" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50 hover:brightness-95"
              style={{
                backgroundColor: 'var(--gn)',
                color: 'var(--gd)',
                fontFamily: 'var(--font-sora)',
              }}
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ti ti-loader-2 animate-spin text-base" />
                  Criando conta...
                </span>
              ) : (
                'Criar conta e começar'
              )}
            </button>

            <p className="text-center text-sm" style={{ color: 'var(--gx)' }}>
              Já tem uma conta?{' '}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: 'var(--gd)' }}>
                Entrar
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
