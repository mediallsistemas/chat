# 20 — Componentes Compartilhados (Reduzir Duplicação)
> ⚠️ **Dependência:** Fazer APÓS os planos 10 (onError — cria `ToastContainer`) e 19 (react-hook-form — cria `FormField`). Este plano referencia ambos os componentes e completa o barrel export do `index.ts`.
**Prioridade:** 🟡 Média
**Tempo estimado:** 4h
**Área:** Code Duplication + Manutenibilidade

---

## Problema

Vários padrões de UI são copy-paste entre páginas:
- Skeleton de loading: `[1,2,3].map(i => <div key={i} className="h-16 animate-pulse" />)` aparece em 8+ páginas
- Modal de formulário: estrutura de label + input + botões duplicada em 15+ modais
- Badges de status/prioridade: mesmos mapas de cor definidos em múltiplos arquivos
- `formatSize()` e `fileIcon()` definidos em `documentos/page.tsx` em vez de `lib/utils.ts`

---

## Implementação

### 1. SkeletonList — eliminar copy-paste de loading states

```typescript
// apps/frontend/src/components/ui/skeleton-list.tsx
interface SkeletonListProps {
  count?: number
  height?: string
  className?: string
}

export function SkeletonList({ count = 3, height = 'h-16', className }: SkeletonListProps) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${height} rounded-xl bg-gs/10 animate-pulse`} />
      ))}
    </div>
  )
}

// Variante para cards em grid
export function SkeletonGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 ${className ?? ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-gs/10 animate-pulse" />
      ))}
    </div>
  )
}
```

Uso (substitui copy-paste em todas as páginas):
```typescript
// Antes (em cada página):
{isLoading && [1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-gs/10 animate-pulse" />)}

// Depois:
{isLoading && <SkeletonList count={3} height="h-16" />}
```

### 2. EmptyState — estado vazio consistente

```typescript
// apps/frontend/src/components/ui/empty-state.tsx
interface EmptyStateProps {
  icon: string          // ex: 'ti-ticket'
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-20 text-gs">
      <i className={`ti ${icon} text-4xl block mb-3 opacity-30`} />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs mt-1">{description}</p>}
      {action && (
        <Button className="mt-4" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

Uso:
```typescript
// Antes:
{!isLoading && tickets.length === 0 && (
  <div className="text-center py-20 text-gs">
    <i className="ti ti-ticket text-4xl block mb-3 opacity-30" />
    <p className="text-sm">Nenhum chamado encontrado.</p>
  </div>
)}

// Depois:
{!isLoading && tickets.length === 0 && (
  <EmptyState
    icon="ti-ticket"
    title="Nenhum chamado encontrado"
    action={{ label: 'Novo chamado', onClick: () => setShowCreate(true) }}
  />
)}
```

### 3. Mover utilitários de arquivo para lib/utils.ts

```typescript
// apps/frontend/src/lib/file-utils.ts
export function fileIcon(mime: string): string {
  if (mime.startsWith('image/')) return 'ti-photo'
  if (mime.includes('pdf')) return 'ti-file-type-pdf'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'ti-file-type-xls'
  if (mime.includes('word') || mime.includes('document')) return 'ti-file-type-doc'
  if (mime.includes('video')) return 'ti-video'
  return 'ti-file'
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
```

Remover definição duplicada de `documentos/page.tsx` e importar de `@/lib/file-utils`.

### 4. Badges de status reutilizáveis

```typescript
// apps/frontend/src/components/ui/status-badge.tsx
import { clsx } from 'clsx'
import { TicketStatus, TicketPriority } from '@mediall/types'

const TICKET_STATUS_STYLE: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'bg-blue-50 text-blue-700',
  [TicketStatus.IN_PROGRESS]: 'bg-yellow-50 text-yellow-700',
  [TicketStatus.PENDING]: 'bg-orange-50 text-orange-700',
  [TicketStatus.RESOLVED]: 'bg-green-50 text-green-700',
  [TicketStatus.CLOSED]: 'bg-gs/10 text-gs',
}

const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  [TicketStatus.OPEN]: 'Aberto',
  [TicketStatus.IN_PROGRESS]: 'Em andamento',
  [TicketStatus.PENDING]: 'Pendente',
  [TicketStatus.RESOLVED]: 'Resolvido',
  [TicketStatus.CLOSED]: 'Fechado',
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', TICKET_STATUS_STYLE[status])}>
      {TICKET_STATUS_LABEL[status]}
    </span>
  )
}
```

### 5. Atualizar barrel exports

```typescript
// apps/frontend/src/components/ui/index.ts
export * from './button'
export * from './modal'
export * from './skeleton-list'    // novo
export * from './empty-state'      // novo
export * from './status-badge'     // novo
export * from './form-field'       // novo (do arquivo 19)
export * from './toast-container'  // novo (do arquivo 10)
```

### 6. Páginas a atualizar

| Página | O que substituir |
|--------|-----------------|
| `chamados/page.tsx` | SkeletonList + EmptyState + remover STATUS_STYLE/LABEL |
| `documentos/page.tsx` | SkeletonList + EmptyState + importar fileIcon/formatSize de lib |
| `impedimentos/page.tsx` | SkeletonList + EmptyState |
| `processos/page.tsx` | SkeletonList |
| `kanban/[boardId]/page.tsx` | SkeletonList |
| `reunioes/page.tsx` | SkeletonList + EmptyState |
| `mensagens/page.tsx` | SkeletonList |

---

## Arquivos criados/modificados
- `apps/frontend/src/components/ui/skeleton-list.tsx` — novo
- `apps/frontend/src/components/ui/empty-state.tsx` — novo
- `apps/frontend/src/components/ui/status-badge.tsx` — novo
- `apps/frontend/src/components/ui/index.ts` — adicionar exports
- `apps/frontend/src/lib/file-utils.ts` — novo (mover de documentos/page.tsx)
- `apps/frontend/src/app/(auth)/chamados/page.tsx` — usar novos componentes
- `apps/frontend/src/app/(auth)/documentos/page.tsx` — usar novos componentes + importar utils
