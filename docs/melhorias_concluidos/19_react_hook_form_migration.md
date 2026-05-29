# 19 — Migrar Formulários para react-hook-form + zod
> ⚠️ **Dependência:** Fazer APÓS o plano 10 (onError Mutations). O plano 20 (Shared Components) espera que os formulários já estejam com react-hook-form para criar o componente `FormField` correto.
**Prioridade:** 🟡 Média
**Tempo estimado:** 6h
**Área:** Good Practices + UX

---

## Problema

Os formulários das páginas chamados, documentos, reuniões e impedimentos usam raw `useState` por campo. Isso viola o padrão definido em CLAUDE.md e causa:
- Sem validação client-side antes do submit
- Sem feedback de erro por campo
- Estado de formulário não é resetado corretamente após fechar modal
- Re-renders desnecessários a cada keystroke

---

## Implementação

### 1. Verificar instalação (já deve existir)

```bash
cd apps/frontend
# Se não instalado:
npm i react-hook-form zod @hookform/resolvers
```

### 2. Padrão a seguir — exemplo com Chamados

```typescript
// apps/frontend/src/app/(auth)/chamados/page.tsx

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Schema de validação
const createTicketSchema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres').max(200, 'Máximo 200 caracteres'),
  description: z.string().min(10, 'Descreva o problema com mais detalhes'),
  priority: z.nativeEnum(TicketPriority),
  category: z.string().optional(),
  dueDate: z.string().optional(),
})

type CreateTicketForm = z.infer<typeof createTicketSchema>

// Dentro do componente:
const form = useForm<CreateTicketForm>({
  resolver: zodResolver(createTicketSchema),
  defaultValues: {
    priority: TicketPriority.MEDIUM,
    title: '',
    description: '',
    category: '',
    dueDate: '',
  },
})

async function handleCreate(data: CreateTicketForm) {
  await createTicket.mutateAsync({
    title: data.title,
    description: data.description,
    priority: data.priority,
    category: data.category || undefined,
    dueDate: data.dueDate || undefined,
  })
  form.reset()
  setShowCreate(false)
}

// No JSX do formulário:
<form onSubmit={form.handleSubmit(handleCreate)}>
  <div>
    <label className="block text-sm font-medium text-gd mb-1">Título</label>
    <input
      {...form.register('title')}
      className="input w-full"
      placeholder="Descreva o problema brevemente"
    />
    {form.formState.errors.title && (
      <p className="text-xs text-red-500 mt-1">{form.formState.errors.title.message}</p>
    )}
  </div>

  <div>
    <label className="block text-sm font-medium text-gd mb-1">Prioridade</label>
    <select {...form.register('priority')} className="input w-full">
      {Object.values(TicketPriority).map((p) => (
        <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
      ))}
    </select>
  </div>

  <Button
    type="submit"
    loading={createTicket.isPending}
    disabled={!form.formState.isValid}
  >
    Criar chamado
  </Button>
</form>
```

### 3. Componente de campo reutilizável

```typescript
// apps/frontend/src/components/ui/form-field.tsx
import { FieldError } from 'react-hook-form'

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
          <i className="ti ti-alert-circle text-[12px]" />
          {error.message}
        </p>
      )}
    </div>
  )
}
```

Uso:
```typescript
<FormField label="Título" error={form.formState.errors.title} required>
  <input {...form.register('title')} className="input w-full" />
</FormField>
```

### 4. Formulários a migrar

**`chamados/page.tsx`** — createTicketSchema (title, description, priority, category, dueDate)

**`documentos/page.tsx`:**
```typescript
const createFolderSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(100),
})

const uploadDocumentSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  file: z.instanceof(File, { message: 'Selecione um arquivo' }),
})
```

**`reunioes/page.tsx`:**
```typescript
const createMeetingSchema = z.object({
  title: z.string().min(3, 'Mínimo 3 caracteres'),
  description: z.string().optional(),
  startAt: z.string().min(1, 'Informe o horário de início'),
  endAt: z.string().min(1, 'Informe o horário de término'),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).default('NONE'),
})
```

**`impedimentos/page.tsx`:**
```typescript
const createImpedimentSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  taskId: z.string().uuid().optional(),
  responsibleForResolutionId: z.string().uuid().optional(),
})
```

### 5. Reset correto ao fechar modal

```typescript
// Com react-hook-form, o reset é mais confiável:
function handleClose() {
  form.reset() // Limpa todos os campos + erros
  setShowCreate(false)
}

// E ao fechar via ESC ou backdrop do Modal:
<Modal open={showCreate} onClose={handleClose} title="Novo chamado">
```

---

## Benefícios após migração

- Validação por campo antes do submit
- Mensagens de erro inline (não alert ou toast genérico)
- `isValid` disponível para desabilitar botão submit
- Reset confiável ao abrir/fechar modal
- Performance: sem re-render global a cada keystroke (apenas o campo modificado re-renderiza)

---

## Arquivos modificados
- `apps/frontend/src/app/(auth)/chamados/page.tsx` — migrar form para react-hook-form
- `apps/frontend/src/app/(auth)/documentos/page.tsx` — migrar 2 forms
- `apps/frontend/src/app/(auth)/reunioes/page.tsx` — migrar form de criação
- `apps/frontend/src/app/(auth)/impedimentos/page.tsx` — migrar form
- `apps/frontend/src/components/ui/form-field.tsx` — novo componente
