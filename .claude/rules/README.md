# Regras de Engenharia — Mediall Brasil

Este diretório contém as **regras vivas** que toda mudança no código deve respeitar.
São derivadas da arquitetura real do repositório (verificada no código, não só nos docs)
e servem para que qualquer melhoria use as boas práticas já estabelecidas.

> Idioma: regras em **português**. Código, nomes e identificadores em **inglês**.
> Texto de UI exibido ao usuário em **português**. (ver `CLAUDE.md` raiz)

## Arquivos

| Arquivo | Quando consultar |
|---------|------------------|
| [`architecture.md`](architecture.md) | Criar/alterar módulo, contexto, controller, service, evento, query, job, schema Prisma, rota |
| [`ui.md`](ui.md) | Criar/alterar qualquer tela, componente, formulário, hook de dados, estado, estilo, **tratativa de erro e feedback ao usuário** (§7) |
| [`security.md`](security.md) | Mexer em auth, sessão, CSRF, isolamento por unidade, upload, secrets, logs, permissões |

## Como usar (para o agente e para devs)

1. **Antes de implementar** uma melhoria, leia a regra da área tocada.
2. Toda regra marcada com **🔴 OBRIGATÓRIO** é bloqueante — não faça PR que a viole.
3. Regras marcadas com **🟡 PADRÃO** são o caminho esperado; desviar exige justificativa no PR.
4. Se a regra divergir do código atual, o **código atual manda** — atualize a regra e avise.
5. Documentos de planejamento detalhados continuam em `docs/`; estas regras são o resumo acionável.

## Dívidas técnicas conhecidas (não repetir, corrigir quando tocar)

- ~~`tailwind.config.ts` content sem `./src/features/**` e `./src/shared/**`~~ — **resolvido**:
  o `content` já inclui `app/**`, `features/**`, `shared/**`, `components/**`, `pages/**`.
- Fallbacks de secret de desenvolvimento ainda existem no código (ex.: `'dev-secret'` em
  `infrastructure/gateway/gateway.module.ts`). Ver `security.md` §2.
- Migração `src/components` + `src/hooks` → `src/features` + `src/shared` em andamento.
  Código novo já nasce na estrutura nova. Ver `ui.md` §1.
- **SaaS multitenant em implementação** (planos `docs/melhorias/23_26_INDICE_SAAS.md`): `tenant_id`
  está sendo adicionado a todos os models (nullable na transição); `TenantGuard`/Prisma
  Extension/RLS são o alvo. Código novo já deve assumir o isolamento por tenant
  (`architecture.md` §0, `security.md` §0).
