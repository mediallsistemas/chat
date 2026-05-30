# 10 — onError em Mutations do Frontend
**Prioridade:** 🔴 Crítico — fazer antes do go-live
**Tempo estimado:** 3h
**Área:** Tratamento de Erros + UX

---

## Problema

Todos os hooks de mutation (`useCreateTicket`, `useUploadDocument`, `useDeleteFolder`, etc.) têm `onSuccess` mas nenhum tem `onError`. Quando uma API retorna erro, o usuário vê... nada. O botão para de carregar e a ação falha silenciosamente.

---

## Implementação

### 1. Criar utilitário de mensagem de erro

```typescript
// apps/frontend/src/lib/get-error-message.ts
import axios from 'axios'

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const serverMessage = err.response?.data?.message
    if (typeof serverMessage === 'string') return serverMessage
    if (Array.isArray(serverMessage)) return serverMessage.join(', ')
    return `Erro ${err.response?.status ?? 'de rede'}`
  }
  if (err instanceof Error) return err.message
  return 'Erro inesperado. Tente novamente.'
}
```

### 2. Criar hook de toast/notificação

Como o projeto não tem biblioteca de toast, criar um hook simples com estado local ou usar o sistema de notificações existente. A opção mais leve:

```typescript
// apps/frontend/src/hooks/use-toast.ts
'use client'

import { useState, useCallback } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning'
}

// Estado global simples via módulo (evita prop drilling sem adicionar Zustand)
let listeners: ((toasts: Toast[]) => void)[] = []
let toasts: Toast[] = []

function notify(toast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2)
  toasts = [...toasts, { ...toast, id }]
  listeners.forEach((l) => l(toasts))
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    listeners.forEach((l) => l(toasts))
  }, 4000)
}

export const toast = {
  success: (message: string) => notify({ message, type: 'success' }),
  error: (message: string) => notify({ message, type: 'error' }),
  warning: (message: string) => notify({ message, type: 'warning' }),
}

export function useToasts() {
  const [state, setState] = useState<Toast[]>(toasts)
  useState(() => {
    listeners.push(setState)
    return () => { listeners = listeners.filter((l) => l !== setState) }
  })
  return state
}
```

### 3. Componente ToastContainer

```typescript
// apps/frontend/src/components/ui/toast-container.tsx
'use client'

import { useToasts } from '@/hooks/use-toast'
import { clsx } from 'clsx'

export function ToastContainer() {
  const toasts = useToasts()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'rounded-xl px-4 py-3 text-sm font-medium shadow-lg pointer-events-auto',
            t.type === 'error' && 'bg-red-600 text-white',
            t.type === 'success' && 'bg-gd text-white',
            t.type === 'warning' && 'bg-yellow-500 text-white',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
```

Adicionar no layout autenticado:
```typescript
// apps/frontend/src/app/(auth)/layout.tsx
import { ToastContainer } from '@/components/ui/toast-container'

export default function AuthLayout({ children }) {
  return (
    <div className="flex h-screen ...">
      <Sidebar />
      <div className="flex flex-col flex-1 ...">
        <Header />
        <main>{children}</main>
      </div>
      <InstallPwaBanner />
      <ToastContainer />
    </div>
  )
}
```

### 4. Padrão a seguir em todos os hooks de mutation

```typescript
// Exemplo: use-tickets.ts
import { toast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/get-error-message'

export function useCreateTicket() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dto: CreateTicketDto) => { ... },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Chamado criado com sucesso')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}
```

### 5. Hooks a atualizar

**`use-tickets.ts`:** useCreateTicket, useUpdateTicket, useAddTicketComment

**`use-documents.ts`:** useCreateFolder, useDeleteFolder, useUploadDocument, useDeleteDocument

**`use-strategic.ts`:** useCreatePlan, useUpdatePlan, useCreateObjective, useCreateGoal

**`use-kanban.ts`:** useMoveTask, useCreateTask, useUpdateTask, useDeleteTask

**`use-meetings.ts`:** useCreateMeeting, useCancelMeeting

**`use-impediments.ts`:** useCreateImpediment, useResolveImpediment

---

## Arquivos criados/modificados
- `apps/frontend/src/lib/get-error-message.ts` — novo utilitário
- `apps/frontend/src/hooks/use-toast.ts` — novo hook
- `apps/frontend/src/components/ui/toast-container.tsx` — novo componente
- `apps/frontend/src/app/(auth)/layout.tsx` — adicionar ToastContainer
- `apps/frontend/src/hooks/use-tickets.ts` — onError em todas as mutations
- `apps/frontend/src/hooks/use-documents.ts` — onError em todas as mutations
- (e demais hooks listados acima)
