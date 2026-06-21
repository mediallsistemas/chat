# Plano Estratégico — Gerência Médica 2026 (Mediall Brasil)

> **Por que este arquivo existe:** os dados do banco de desenvolvimento **não são reais** e serão
> resetados durante a evolução do modelo multi-unidade (plano 24). Este documento **preserva o
> conteúdo do plano "Gerência Médica 2026"** (objetivos, metas, etapas, macro-tarefas e tarefas)
> para que possa ser re-semeado quando quiser.
>
> **Fonte canônica (código):** [`apps/backend/prisma/seed-strategic.ts`](../../apps/backend/prisma/seed-strategic.ts)
> — o array `objectivesDef` contém exatamente a estrutura abaixo. Rode com
> `npx ts-node prisma/seed-strategic.ts`.

- **Nome:** Gerência Médica 2026
- **Ano:** 2026
- **Status:** ACTIVE
- **Unidades-alvo (seed):** Matriz, UEI, HRGM, HMMDO, HRPG, UPA Zona Sul

**Visão:** Ser reconhecida como a Gerência Médica de alta performance que consolida governança
clínica, padroniza a prática assistencial e, de forma interdisciplinar, transforma a complexidade
operacional em previsibilidade, segurança e resultado, sustentando a expansão nacional e
internacional da Mediall Brasil com controle de risco e excelência assistencial.

**Missão:** Garantir qualidade assistencial, segurança do paciente e eficiência operacional nas
unidades sob gestão da Mediall Brasil, alinhando a prática médica a processos padronizados,
decisões orientadas por dados e governança clínica, em consonância com os indicadores
assistenciais, as metas contratuais e a estratégia corporativa.

**Valores:** Ética, transparência, credibilidade, competência, comprometimento, profissionalismo
e atenção ao bem-estar de pacientes e colaboradores.

---

## Objetivo 1 — Institucionalizar a padronização da prática médica
*Responsável: Gabriel · farol GREEN · progresso 32%*

Garantir que decisões clínicas críticas sejam orientadas por protocolos, diretrizes institucionais
e plano terapêutico multidisciplinar em todas as unidades até o final de 2026.

**Meta 1.1 — Definir carteira institucional de protocolos clínicos prioritários** (invest. R$45.000 · alvo 100 · atual 40 · 40%)
Por perfil assistencial e nível de complexidade, com 80% dos protocolos de alto impacto homologados até DEZ/2026.
- **Etapa 1 — Mapeamento e priorização** (ARCHIVED · resp. Diretor Operacional)
  - Macro: *Mapear protocolos existentes por unidade* (DONE 100%) — Levantar protocolos UEI/HRGM/HMMDO
  - Macro: *Definir critérios de priorização* (DONE 100%) — Workshop com líderes médicos · Matriz de impacto x complexidade
- **Etapa 2 — Construção dos protocolos** (ACTIVE · resp. Ger. Enfermagem)
  - Macro: *Redigir protocolos de alta complexidade* (IN_PROGRESS 55%) — Sepse (done), IAM, AVC, PCR, Revisão científica externa
  - Macro: *Validar protocolos com equipe multidisciplinar* (IN_PROGRESS 20%) — Enfermagem UEI (done), Farmácia, Laboratório, **validação Imagem (BLOQUEADO)**
- **Etapa 3 — Homologação e publicação** (LOCKED · resp. Gabriel)

**Meta 1.2 — Implantar Plano Terapêutico Multidisciplinar (PTM) como padrão** (invest. R$28.000 · alvo 100 · atual 15 · 15%)
PTM obrigatório em 100% das internações de alta complexidade nas 5 unidades operacionais até DEZ/2026.
- **Etapa 1 — Desenho do modelo institucional** (ACTIVE · resp. Diretor Operacional)
  - Macro: *Construir template padrão de PTM* (IN_PROGRESS 40%) — Campos obrigatórios (done), Validar com Diretoria, Integração com prontuário

---

## Objetivo 2 — Garantir a segurança do paciente como ativo estratégico
*Responsável: Diretor Operacional · farol YELLOW · progresso 18%*

Estruturar e consolidar a cultura de segurança do paciente, tornando notificação, análise e
aprendizado com eventos adversos prática regular e integrada à governança até DEZ/2026.

**Meta 2.1 — Implantar sistema institucional de notificação de eventos adversos** (invest. R$35.000 · alvo 300 · atual 80 · 27% · AT_RISK)
Triplicar a taxa de notificação de near-miss vs. linha de base 2025 até DEZ/2026.
- **Etapa 1 — Capacitação e adesão** (ACTIVE · resp. Ger. CCIH)
  - Macro: *Treinar lideranças em cultura justa* (IN_PROGRESS 50%) — Treinamento Matriz/UEI (done), HRGM, HMMDO/HRPG, **pendência de sala (BLOQUEADO)**
  - Macro: *Lançar canal anônimo de notificação* (REVIEW 80%) — Sistema (done), Material de divulgação (review), Política de confidencialidade (done)
- **Etapa 2 — Análise sistemática e aprendizado** (LOCKED · resp. Diretor Operacional)

---

## Objetivo 3 — Fortalecer comissões hospitalares como instrumentos de governança
*Responsável: Ger. CCIH · farol GREEN · progresso 45%*

Reativar e qualificar CCIH, CFT, Óbitos e Prontuários como instâncias decisórias ativas, com
pauta, frequência e produtos institucionais até JUN/2026.

**Meta 3.1 — Reestruturar comissões obrigatórias em todas as unidades** (invest. R$12.000 · alvo 4 · atual 2 · 50%)
CCIH, Comissão de Óbitos, Farmácia e Terapêutica, Revisão de Prontuários — pauta mensal e atas publicadas.
- **Etapa 1 — Diagnóstico das comissões atuais** (ARCHIVED · resp. Ger. CCIH)
  - Macro: *Levantar regimento e composição vigente* (DONE 100%) — Regimentos UEI/HRGM, Consolidar gaps
- **Etapa 2 — Reativação e calendário institucional** (ACTIVE · resp. Ger. CCIH)
  - Macro: *Publicar calendário oficial 2026* (DONE 100%) — Aprovação Diretoria, Publicação interna
  - Macro: *Realizar 1ª rodada de reuniões* (IN_PROGRESS 60%) — CCIH UEI/HRGM (done), CFT todas, Óbitos HMMDO, Publicar atas

---

## Objetivo 4 — Elevar a eficiência operacional médica
*Responsável: Diretor Financeiro · farol YELLOW · progresso 22%*

Consolidar a eficiência operacional médica como princípio institucional, alinhando produtividade,
uso de leitos, fluxos assistenciais e tomada de decisão até DEZ/2026.

**Meta 4.1 — Definir modelo padrão de produtividade médica** (invest. R$18.000 · alvo 100 · atual 25 · 25%)
Por perfil assistencial e nível de complexidade, com aplicação contratual nas 5 unidades.
- **Etapa 1 — Definição de indicadores** (ACTIVE · resp. Diretor Financeiro)
  - Macro: *Definir matriz de indicadores de produtividade* (IN_PROGRESS 35%) — Benchmark mercado (done), Workshop com gerentes, Validação com Diretoria, Documentar matriz final
  - Macro: *Gestão ativa de leitos e permanência* (IN_PROGRESS 10%) — Painel de leitos por unidade, Critérios de alta hospitalar

---

## Objetivo 5 — Institucionalizar a gestão orientada por dados
*Responsável: Gabriel · farol RED · progresso 5%*

Garantir que decisões estratégicas, táticas e operacionais sejam fundamentadas em indicadores
assistenciais, operacionais, financeiros e de governança até DEZ/2026.

**Meta 5.1 — Painel executivo de indicadores médicos** (invest. R$60.000 · alvo 100 · atual 5 · 5% · AT_RISK)
Dashboard único consolidado das 5 unidades, atualização semanal, integrado ao painel da Diretoria.
- **Etapa 1 — Levantamento de fontes de dados** (ACTIVE · resp. Rafael)
  - Macro: *Mapear sistemas-fonte por unidade* (IN_PROGRESS 15%) — Entrevistas com gerentes, Inventário UEI/HRGM, **acesso ao MV (BLOQUEADO)**
- **Etapa 2 — Construção do painel** (LOCKED · resp. Rafael)

---

> Estrutura completa (responsáveis exatos, datas relativas, colunas de cada tarefa) está no
> array `objectivesDef` em `seed-strategic.ts`. Origem: planilha
> *"Planilha-de-Planejamento-Estrategico_Gerencia_medica_2026"*.
