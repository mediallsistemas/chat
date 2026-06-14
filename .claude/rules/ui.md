# Regras de UI / Frontend (Next.js App Router)

Estrutura vigente: **feature-first**. Domínios em `src/features/<feature>/`
(hooks/, components/, store/). Reutilizável e não-domínio em `src/shared/`
(components/ui, components/layout, lib, hooks, store). A pasta antiga
`src/components/` + `src/hooks/` está sendo **removida** — código novo nasce na estrutura nova.

> Texto exibido ao usuário: **português**. Código/identificadores: **inglês**.

---

## 1. Organização de pastas 🔴 OBRIGATÓRIO

- Lógica de um domínio → `src/features/<feature>/`:
  - `hooks/` — queries/mutations TanStack Query (`use-<feature>.ts`)
  - `components/` — componentes específicos do domínio (modais, views) + `index.ts` (barrel)
  - `store/` — Zustand **só** quando o domínio precisa de estado de sessão/contexto
- Reutilizável e transversal → `src/shared/`:
  - `components/ui/` — primitivos (Button, Input, Modal, FormModal, Badge, TrafficLight, ...)
  - `components/layout/` — Sidebar, Header, RoleGuard
  - `lib/` — `api.ts`, `query-client.ts`, `socket.ts`, `get-error-message.ts`
  - `store/` — `ui-store.ts` (e stores de sessão como unit/auth)
- **Não** crie nada novo em `src/components/` ou `src/hooks/` (legado em remoção).
- Sem import cruzado entre features: um feature fala com outro **via `shared/`**, não importando
  `features/a` dentro de `features/b`.
- Todo folder de componentes exporta por `index.ts` (barrel).

## 2. Componentes UI 🔴 OBRIGATÓRIO — reusar antes de criar

- Antes de estilizar do zero, use o primitivo de `src/shared/components/ui/`:
  `Button`, `Input`/`Select`/`Textarea`, `Modal`, `FormModal`, `FormField`, `Badge`,
  `StatusBadge`, `TrafficLight`, `Avatar`, `UserCombobox`, `Spinner`, `ProgressBar`,
  `SkeletonList`/`SkeletonGrid`, `EmptyState`, `ToastContainer`.
- **Botões**: `<Button variant="primary|secondary|ghost|danger|outline" size="sm|md|lg" loading>`.
  Não escreva `<button className="bg-...">` à mão para ações.
- **Estilo**: Tailwind + `clsx` para variantes condicionais. Siga o padrão de variante do
  `Button`/`Input` quando criar primitivo novo. Sem CSS inline, sem styled-components.
- Ícones: **Tabler Icons** via webfont (`<i className="ti ti-... " aria-hidden="true" />`).

## 3. Design tokens 🔴 OBRIGATÓRIO — nunca hex cru

Use sempre os tokens do `tailwind.config.ts`, nunca cores hex literais no JSX:

| Token | Hex | Uso |
|-------|-----|-----|
| `gd` | `#0D3B2E` | verde escuro — texto/títulos/primário |
| `gm` | `#1A4D3A` | verde médio — secundário |
| `gn` | `#BFEF45` | lima — destaque, fundo de botão primário |
| `gs` | `#C8D4C9` | sálvia — bordas, desabilitado |
| `gx` | `#6B7E6D` | sálvia escuro — texto/ícone secundário |
| `page-bg` | `#EDF2EE` | fundo de página |

- **Farol / TrafficLight** é o padrão visual de status: `GREEN` (No prazo) / `YELLOW` (Atenção) /
  `RED` (Atrasado) / `GRAY` (Sem dados). Use o componente `TrafficLight`, não recrie as cores.
- Fontes: `font-sora` (títulos/logo), `font-sans` = DM Sans (corpo).
- Tema **claro apenas** (sem dark mode hoje). Não introduza dark mode sem decisão de produto.
- ⚠️ Dívida: `tailwind.config.ts` `content` ainda não inclui `./src/features/**` e
  `./src/shared/**`. Ao tocar em estilos, adicione esses globs ou classes novas serão purgadas.

## 4. Formulários 🔴 OBRIGATÓRIO

- **Sempre** `react-hook-form` + `zod` (`zodResolver`). Nunca `useState` por campo de form.
- Mensagens de validação do zod em português (`'Nome deve ter ao menos 3 caracteres'`).
- Campos via `Input`/`Select`/`Textarea` + `FormField` (label + erro). Campos complexos
  (ex.: `UserCombobox`) via `useController`.
- Modais de formulário usam `FormModal` (form + footer submit/cancelar prontos). Passe
  `onSubmit={handleSubmit(onValid)}` e `isPending` da mutation. Não recrie o footer à mão.
- Botão de submit mostra `loading`; só ele tem spinner inline (ver §6).

## 5. Dados (TanStack Query + Axios) 🔴 OBRIGATÓRIO

- **Todo fetch/mutation passa por TanStack Query.** Zustand guarda só sessão/contexto/UI,
  **nunca** dados de domínio (esses ficam no cache do Query).
- Cliente HTTP único: `src/shared/lib/api.ts` (`api`, axios com `withCredentials: true`).
  Ele já cuida de CSRF, correlation-id e retry de auth — **não crie outra instância axios**.
- Resposta vem embrulhada `{ data, statusCode }` → desembrulhe com `.then(r => r.data.data)`.
- **Query keys hierárquicas e com `unitId`**: `['plans', unitId]`, `['kanban', unitId, boardId]`,
  `['meetings', unitId]`. `unitId` vem de `useUnitStore(s => s.activeUnit?.id)` e a query usa
  `enabled: !!unitId`.
- Mutations: invalidar as keys afetadas (`qc.invalidateQueries({ queryKey: ['meetings', unitId] })`)
  e dar feedback com `toast.success(...)` / `toast.error(getErrorMessage(err))`.
- Trocar de unidade invalida queries dependentes de `unitId` — não cacheie dados de unidade
  fora do Query.

## 6. Estados de loading 🔴 OBRIGATÓRIO

- **Skeleton por componente** no carregamento inicial (`SkeletonList`/`SkeletonGrid`,
  `*-skeleton.tsx`), **não** spinner de página inteira.
- **Spinner só em botão de submit** (`<Button loading>`).
- Botão em loading fica desabilitado (o `Button` já faz isso com `loading`) para evitar
  duplo submit.

## 7. Tratativa de erro — o usuário precisa saber o que aconteceu 🔴 OBRIGATÓRIO

Princípio: **nenhuma ação falha em silêncio.** Toda operação tem um de três desfechos visíveis ao
usuário — sucesso, erro tratado, ou estado de carregamento. Erro engolido (só `console.error`,
`catch {}` vazio, promessa sem `.catch`) é proibido.

### 7.1 Mensagem sempre em português e acionável

- O backend devolve mensagens **em inglês** para erros genéricos (5xx, Prisma) — ex.:
  `'Internal server error'`, `'Resource already exists'`, `'Database operation failed'`.
  **Nunca jogue essas strings cruas na tela.** Validações de negócio (4xx) já vêm em PT do
  backend e podem ser exibidas.
- Sempre extraia com **`getErrorMessage(err)`** (`src/shared/lib/get-error-message.ts`). Não faça
  parse de erro axios à mão. Se a mensagem do backend não for amigável/PT, troque por um texto
  claro no `catch` (ex.: `toast.error('Não foi possível salvar a tarefa. Tente novamente.')`).
- Toda mensagem diz **o que falhou** e **o que fazer** quando possível
  ("Não foi possível enviar. Verifique sua conexão e tente novamente."), não "Erro 500".

### 7.2 Onde mostrar cada tipo de erro

| Situação | Como avisar |
|----------|-------------|
| Mutation falhou (salvar, excluir, enviar) | `toast.error(getErrorMessage(err))` no `onError` da mutation |
| Mutation OK | `toast.success('...')` — confirme a ação ("Tarefa criada.") |
| Query inicial da página falhou | `error.tsx` da rota (boundary) com CTA "Tentar novamente" (`reset()`) |
| Query de um bloco falhou (sem derrubar a página) | estado de erro inline no componente + botão `refetch()` |
| Lista vazia (não é erro) | `EmptyState` com texto e, se cabível, ação — não confundir com erro |
| Erro de validação de campo | mensagem no próprio campo via `FormField` (zod), **não** toast |
| Sessão expirada (401) | o `api.ts` já redireciona para `/login`; não trate manualmente |
| CSRF (403 EBADCSRFTOKEN) | o `api.ts` já reenvia; não trate manualmente |

### 7.3 Padrão de mutation (copie isto)

```ts
const { mutate, isPending } = useMutation({
  mutationFn: (dto) => api.post(url, dto).then((r) => r.data.data),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['tasks', unitId] })
    toast.success('Tarefa criada.')
  },
  onError: (err) => toast.error(getErrorMessage(err)),
})
```

- **Toda** mutation tem `onError` com toast. Sem exceção.
- Feedback de sucesso também é obrigatório em ações que o usuário não vê o resultado na hora
  (salvar config, enviar convite). Em ações com efeito visual imediato (mover card no Kanban),
  o sucesso pode ser só a UI atualizando.

### 7.4 Padrão de query com erro inline (bloco que não derruba a página)

```tsx
const { data, isLoading, isError, refetch } = useQuery({ ... })
if (isLoading) return <SkeletonList count={3} />
if (isError) return (
  <div className="flex flex-col items-center gap-2 py-8 text-center">
    <i className="ti ti-alert-triangle text-3xl text-gs" aria-hidden="true" />
    <p className="text-sm text-gx">Não foi possível carregar. Tente novamente.</p>
    <Button size="sm" variant="secondary" onClick={() => refetch()}>Tentar novamente</Button>
  </div>
)
```

### 7.5 error.tsx (boundary de rota) 🔴 OBRIGATÓRIO

- **Toda rota autenticada tem `error.tsx`** (já é padrão; mantenha). Estrutura: ícone Tabler em
  `text-gs`, título em `text-gd` ("Erro ao carregar X"), descrição curta em PT, e
  `<Button onClick={reset}>Tentar novamente</Button>`. Use os tokens (`gd/gs/gx`), não cores cruas.
- `console.error(error)` no `useEffect` para telemetria; **a mensagem do `error` nunca vai crua
  para a tela** — mostre texto fixo amigável.

### 7.6 Nunca

- ❌ `catch (e) {}` vazio ou só `console.log`. ❌ `.then()` sem `.catch`/`onError`.
- ❌ `alert(...)` / `confirm(...)` nativos — use `toast` e `Modal`.
- ❌ Mostrar stack trace, `correlationId` ou status HTTP cru ao usuário (o `correlationId` pode
  ir para o `console`/Sentry, não para a tela).
- ❌ Toast genérico "Erro" sem contexto. ❌ Travar a página inteira por falha de um bloco isolado.

## 8. Estado (Zustand) 🟡 PADRÃO

- Stores existentes: `authStore` (user/sessão, persistido `mediall-auth`),
  `unitStore` (`activeUnit`/`units`, persistido `mediall-unit`),
  `uiStore` (sidebar — **não** persistido).
- Use o store certo; não crie store novo para dado que o TanStack Query já guarda.
- Componentes que precisam de `unitId` consomem `unitStore.activeUnit`.

## 9. Rotas, auth e permissão 🔴 OBRIGATÓRIO

- Grupos de rota: `(public)` (login), `(auth)` (protegido), `(admin)`.
- `middleware.ts` checa o cookie `auth_token` e redireciona para `/login` se ausente
  (camada leve; a autorização real é no backend).
- Dentro de `(auth)`, `RoleGuard` (`src/shared/components/layout/role-guard.tsx`) redireciona
  `COLABORADOR`/`VISUALIZADOR` de rotas restritas para `/meu`. Rota nova restrita →
  adicione o prefixo em `RESTRICTED_PREFIXES`.
- **Permissão de UI nunca é segurança** — esconder botão não basta; o backend (guard stack)
  é a fonte de verdade. UI só melhora a experiência.
- Seletor de unidade (Header) só aparece para `AccessScope.MULTI`. Trocar unidade invalida
  queries — não duplique essa lógica.

## 10. Server vs Client Components 🟡 PADRÃO

- Server Component: dado inicial (SSR, sem spinner).
- Client Component (`'use client'`): interação, WebSocket, estado local, TanStack Query.
- Componentes pesados (Kanban, drag-and-drop) com `dynamic(..., { ssr: false })`.

## 11. Real-time no front 🟡 PADRÃO

- Socket único: `getSocket()` / `useSocket()` (`src/shared/lib/socket.ts`), singleton lazy,
  `withCredentials`. Não instancie `io(...)` direto no componente.
- Listeners empurram update para o cache do Query (`qc.setQueryData`); sempre faça `socket.off`
  no cleanup do `useEffect`.

## 12. Acessibilidade e qualidade 🟡 PADRÃO

- HTML semântico; `aria-label` em botão só-ícone; ícones decorativos com `aria-hidden="true"`.
- Foco preso e fechamento por Esc/backdrop em modais (já no `Modal` base — reutilize).
- TypeScript `strict`, sem `any`; `import type` para tipos; tipos de contrato de `@mediall/types`.
