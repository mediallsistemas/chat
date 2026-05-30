# 18 — Migrar react-beautiful-dnd → @dnd-kit
**Prioridade:** 🟡 Média
**Tempo estimado:** 8h
**Área:** Performance + Dependências

---

## Problema

`react-beautiful-dnd` está abandonado desde 2020:
- Sem suporte a React 18 Concurrent Mode
- Issues de performance conhecidos em boards com 50+ cards
- Sem manutenção de segurança
- Incompatível com `React.StrictMode` (double-invoke)

`@dnd-kit` é o substituto mantido pela comunidade React — mesmo autor, API mais limpa.

---

## Implementação

### 1. Instalar e remover pacotes

```bash
cd apps/frontend
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm uninstall react-beautiful-dnd @types/react-beautiful-dnd
```

### 2. Comparação de conceitos

| react-beautiful-dnd | @dnd-kit |
|--------------------|---------|
| `<DragDropContext>` | `<DndContext>` |
| `<Droppable>` | `<SortableContext>` |
| `<Draggable>` | `useSortable()` hook |
| `onDragEnd` | `onDragEnd` |
| `provided.draggableProps` | `attributes + listeners + setNodeRef` |

### 3. Estrutura do novo KanbanBoardClient

```typescript
// apps/frontend/src/app/(auth)/kanban/[boardId]/kanban-board-client.tsx
'use client'

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'

export function KanbanBoardClient({ board }: { board: KanbanBoard }) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const moveTask = useMoveTask()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // 8px antes de ativar drag
    }),
  )

  function handleDragStart(event: DragStartEvent) {
    const task = board.columns
      .flatMap((c) => c.tasks)
      .find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)

    if (!over || active.id === over.id) return

    const sourceColumnId = findColumnByTask(String(active.id))
    const targetColumnId = findColumnByTask(String(over.id)) ?? String(over.id)

    if (!sourceColumnId || !targetColumnId) return

    moveTask.mutate({
      taskId: String(active.id),
      targetColumnId,
      position: getNewPosition(targetColumnId, String(over.id)),
    })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {board.columns.map((column) => (
          <KanbanColumn key={column.id} column={column} />
        ))}
      </div>

      {/* Ghost card durante o drag */}
      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} isDragging />}
      </DragOverlay>
    </DndContext>
  )
}
```

### 4. Componente de coluna

```typescript
// KanbanColumn.tsx
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'

function KanbanColumn({ column }: { column: KanbanColumn }) {
  const { setNodeRef } = useDroppable({ id: column.id })

  return (
    <div ref={setNodeRef} className="w-72 shrink-0 bg-page-bg rounded-xl p-3">
      <h3 className="font-semibold text-gd mb-3">{column.name}</h3>
      <SortableContext
        items={column.tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2 min-h-[100px]">
          {column.tasks.map((task) => (
            <SortableTask key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
```

### 5. Card arrastável

```typescript
// SortableTask.tsx
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableTask({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg border border-gs/60 p-3 cursor-grab active:cursor-grabbing"
    >
      <TaskCard task={task} />
    </div>
  )
}
```

### 6. Vantagens após a migração

- Suporte a React 18 Concurrent Mode
- Funciona com `React.StrictMode` (sem double-invoke issues)
- Acessibilidade melhor (teclado nativo)
- Bundle menor (~15KB vs ~30KB)
- Performance melhor em boards grandes (virtualização possível)
- Manutenção ativa

---

## Arquivos modificados
- `apps/frontend/package.json` — remover react-beautiful-dnd, adicionar @dnd-kit
- `apps/frontend/src/app/(auth)/kanban/[boardId]/kanban-board-client.tsx` — reescrever
- `apps/frontend/src/app/(auth)/kanban/[boardId]/kanban-column.tsx` — reescrever com SortableContext
- `apps/frontend/src/app/(auth)/kanban/[boardId]/sortable-task.tsx` — novo componente
