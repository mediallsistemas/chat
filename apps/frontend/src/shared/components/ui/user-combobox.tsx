'use client'

import { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'
import { Avatar } from './avatar'

export interface UserOption {
  id: string
  name: string
  avatarUrl?: string | null
}

interface Props {
  label?: string
  value: string
  onChange: (userId: string) => void
  users: UserOption[]
  loading?: boolean
  error?: string
  placeholder?: string
}

export function UserCombobox({ label, value, onChange, users, loading, error, placeholder = 'Buscar responsável...' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = users.find((u) => u.id === value)

  const filtered = query.trim()
    ? users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()))
    : users

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && <label className="text-xs font-semibold text-gray-700">{label}</label>}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'w-full rounded-lg border bg-white px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-gd/30',
          error ? 'border-red-400' : 'border-gs',
        )}
      >
        {selected ? (
          <>
            <Avatar name={selected.name} src={selected.avatarUrl} size="xs" />
            <span className="flex-1 truncate text-gray-800">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-gx">{placeholder}</span>
        )}
        <svg className="w-4 h-4 text-gx shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="relative z-50">
          <div className="absolute top-1 left-0 right-0 bg-white border border-gs rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gs">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar..."
                className="w-full text-sm px-2 py-1 rounded border border-gs focus:outline-none focus:ring-1 focus:ring-gd/30"
              />
            </div>
            <ul className="max-h-48 overflow-y-auto">
              {loading && (
                <li className="px-3 py-2 text-sm text-gx">Carregando...</li>
              )}
              {!loading && filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-gx">Nenhum usuário encontrado</li>
              )}
              {filtered.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(u.id); setOpen(false); setQuery('') }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left',
                      u.id === value && 'bg-blue-50 text-blue-700',
                    )}
                  >
                    <Avatar name={u.name} src={u.avatarUrl} size="xs" />
                    <span className="truncate">{u.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
