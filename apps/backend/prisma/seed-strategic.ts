/**
 * Strategic seed — populates a Mediall Brasil Gerência Médica 2026 plan
 * with 5 objectives, their goals, phases, macro-tasks and tasks, mirroring
 * the structure of the spreadsheet "Planilha-de-Planejamento-Estrategico_Gerencia_medica_2026".
 *
 * Run with:  npx ts-node prisma/seed-strategic.ts
 * Idempotent: clears any prior plan with the same name before inserting.
 */

import {
  PrismaClient,
  PlanStatus,
  GoalStatus,
  PhaseStatus,
  TrafficLight,
  Direction,
  CalcMethod,
  UnitScope,
  TaskStatus,
  Priority,
  AcceptanceStatus,
  BoardOwner,
} from '@prisma/client'
import { ensureTenantAndBackfill } from './tenant-backfill'

const prisma = new PrismaClient()

const PLAN_NAME = 'Gerência Médica 2026'
const PLAN_YEAR = 2026

const TARGET_UNIT_IDS = [
  'unit-matriz-mediall',
  'unit-uei',
  'unit-hrgm',
  'unit-hmmdo',
  'unit-hrpg',
  'unit-upa-zona-sul',
]

async function main() {
  console.log('🌱 Strategic seed — Gerência Médica 2026 (replicated across all units)')

  const rafael = await prisma.user.findUniqueOrThrow({ where: { email: 'rafael@gmail.com' } })
  const gabriel = await prisma.user.findUniqueOrThrow({ where: { email: 'gabriel@gmail.com' } })
  const diretorOperacional = await prisma.user.findUniqueOrThrow({
    where: { email: 'diretor.operacional@mediall.com.br' },
  })
  const diretorFinanceiro = await prisma.user.findUniqueOrThrow({
    where: { email: 'diretor.financeiro@mediall.com.br' },
  })
  const gerenteEnfermagem = await prisma.user.findUniqueOrThrow({
    where: { email: 'gerente.enfermagem@mediall.com.br' },
  })
  const gerentePS = await prisma.user.findUniqueOrThrow({
    where: { email: 'gerente.ps@mediall.com.br' },
  })
  const gerenteCCIH = await prisma.user.findUniqueOrThrow({
    where: { email: 'gerente.ccih@mediall.com.br' },
  })

  for (const MATRIZ_ID of TARGET_UNIT_IDS) {
    console.log(`\n── Unit: ${MATRIZ_ID} ──`)

  // ─── Clean previous strategic data for this plan ──────────────────────────
  const prev = await prisma.strategicPlan.findFirst({
    where: { name: PLAN_NAME, year: PLAN_YEAR, unitId: MATRIZ_ID },
    include: { objectives: { include: { goals: { include: { phases: true } } } } },
  })

  if (prev) {
    console.log('   ↻ Removing previous plan instance...')
    const phaseIds = prev.objectives.flatMap((o) => o.goals.flatMap((g) => g.phases.map((p) => p.id)))
    const goalIds = prev.objectives.flatMap((o) => o.goals.map((g) => g.id))
    const objectiveIds = prev.objectives.map((o) => o.id)
    const boardIds = prev.objectives.flatMap((o) =>
      o.goals.flatMap((g) => g.phases.map((p) => p.kanbanBoardId)),
    )

    // Child rows hold RESTRICT FKs to tasks — delete them before the tasks.
    const taskIds = (
      await prisma.task.findMany({
        where: { boardId: { in: boardIds } },
        select: { id: true },
      })
    ).map((t) => t.id)

    if (taskIds.length) {
      await prisma.taskDependency.deleteMany({
        where: { OR: [{ taskId: { in: taskIds } }, { dependsOnId: { in: taskIds } }] },
      })
      await prisma.taskImpediment.deleteMany({ where: { taskId: { in: taskIds } } })
      await prisma.taskChecklist.deleteMany({ where: { taskId: { in: taskIds } } })
      await prisma.taskFile.deleteMany({ where: { taskId: { in: taskIds } } })
    }

    await prisma.task.deleteMany({ where: { board: { id: { in: boardIds } } } })
    await prisma.macroTask.deleteMany({ where: { phaseId: { in: phaseIds } } })
    await prisma.phaseScopeBoard.deleteMany({ where: { phaseId: { in: phaseIds } } })
    await prisma.planPhase.deleteMany({ where: { id: { in: phaseIds } } })
    await prisma.kanbanColumn.deleteMany({ where: { boardId: { in: boardIds } } })
    await prisma.kanbanBoard.deleteMany({ where: { id: { in: boardIds } } })
    await prisma.goal.deleteMany({ where: { id: { in: goalIds } } })
    await prisma.objective.deleteMany({ where: { id: { in: objectiveIds } } })
    await prisma.strategicPlan.delete({ where: { id: prev.id } })
  }

  // ─── Strategic Plan ───────────────────────────────────────────────────────
  const plan = await prisma.strategicPlan.create({
    data: {
      name: PLAN_NAME,
      year: PLAN_YEAR,
      status: PlanStatus.ACTIVE,
      unitId: MATRIZ_ID,
      createdBy: rafael.id,
      vision:
        'Ser reconhecida como a Gerência Médica de alta performance que consolida governança clínica, padroniza a prática assistencial e, de forma interdisciplinar, transforma a complexidade operacional em previsibilidade, segurança e resultado, sustentando a expansão nacional e internacional da Mediall Brasil com controle de risco e excelência assistencial.',
      mission:
        'Garantir qualidade assistencial, segurança do paciente e eficiência operacional nas unidades sob gestão da Mediall Brasil, alinhando a prática médica a processos padronizados, decisões orientadas por dados e governança clínica, em consonância com os indicadores assistenciais, as metas contratuais e a estratégia corporativa.',
      values:
        'Ética, transparência, credibilidade, competência, comprometimento, profissionalismo e atenção ao bem-estar de pacientes e colaboradores.',
    },
  })
  console.log(`✅ Plan created: ${plan.name}`)

  // Plano 24 — atrela o plano à sua unidade (PlanUnit). Sem isto, o plano não aparece
  // em /units/:unitId/plans (que agora filtra por atribuição). tenant_id é preenchido
  // pelo backfill no fim do seed (raw client não passa pelo middleware de tenant).
  await prisma.planUnit.create({
    data: { planId: plan.id, unitId: MATRIZ_ID, status: PlanStatus.ACTIVE, attachedBy: rafael.id },
  })

  // Default Kanban columns for each phase board
  const defaultColumns = [
    { name: 'Backlog', position: 1, isDoneColumn: false, color: '#94A3B8' },
    { name: 'A fazer', position: 2, isDoneColumn: false, color: '#3B82F6' },
    { name: 'Em andamento', position: 3, isDoneColumn: false, color: '#F59E0B' },
    { name: 'Revisão', position: 4, isDoneColumn: false, color: '#A855F7' },
    { name: 'Concluído', position: 5, isDoneColumn: true, color: '#10B981' },
  ]

  // ─── Objectives + Goals + Phases + MacroTasks + Tasks ─────────────────────
  type UserRef = { id: string }
  type TaskDef = {
    title: string
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'DONE'
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    column: number
    blocked?: boolean
  }
  type MacroDef = {
    title: string
    status: TaskStatus
    progress: number
    responsible: UserRef
    startOffsetDays?: number
    dueOffsetDays?: number
    tasks: TaskDef[]
  }
  type PhaseDef = {
    title: string
    order: number
    status: PhaseStatus
    responsible: UserRef
    startOffsetDays?: number
    dueOffsetDays?: number
    completedOffsetDays?: number
    macroTasks: MacroDef[]
  }
  type GoalDef = {
    title: string
    description: string
    investment: number
    target: number
    current: number
    status: GoalStatus
    progressPct: number
    phases: PhaseDef[]
  }
  type ObjectiveDef = {
    title: string
    description: string
    benefits: string
    responsibleUser: UserRef
    status: GoalStatus
    trafficLight: TrafficLight
    progressPct: number
    goals: GoalDef[]
  }

  const objectivesDef: ObjectiveDef[] = [
    {
      title: 'Institucionalizar a padronização da prática médica',
      description:
        'Garantir que decisões clínicas críticas sejam orientadas por protocolos, diretrizes institucionais e plano terapêutico multidisciplinar em todas as unidades até o final de 2026.',
      benefits:
        'Padronizar a prática assistencial reduz variabilidade clínica e risco. Menor dependência de decisões individuais isoladas e maior previsibilidade em ambientes de alta rotatividade médica.',
      responsibleUser: gabriel,
      status: GoalStatus.IN_PROGRESS,
      trafficLight: TrafficLight.GREEN,
      progressPct: 32,
      goals: [
        {
          title: 'Definir carteira institucional de protocolos clínicos prioritários',
          description:
            'Por perfil assistencial e nível de complexidade, com 80% dos protocolos de alto impacto homologados até DEZ/2026.',
          investment: 45000,
          target: 100,
          current: 40,
          status: GoalStatus.IN_PROGRESS,
          progressPct: 40,
          phases: [
            {
              title: 'Mapeamento e priorização',
              order: 1,
              status: PhaseStatus.ARCHIVED,
              responsible: diretorOperacional,
              startOffsetDays: -90,
              dueOffsetDays: -60,
              completedOffsetDays: -55,
              macroTasks: [
                {
                  title: 'Mapear protocolos existentes por unidade',
                  status: TaskStatus.DONE,
                  progress: 100,
                  responsible: gerenteEnfermagem,
                  startOffsetDays: -88,
                  dueOffsetDays: -75,
                  tasks: [
                    { title: 'Levantar protocolos UEI', status: 'DONE', priority: 'HIGH', column: 4 },
                    { title: 'Levantar protocolos HRGM', status: 'DONE', priority: 'HIGH', column: 4 },
                    { title: 'Levantar protocolos HMMDO', status: 'DONE', priority: 'MEDIUM', column: 4 },
                  ],
                },
                {
                  title: 'Definir critérios de priorização',
                  status: TaskStatus.DONE,
                  progress: 100,
                  responsible: diretorOperacional,
                  startOffsetDays: -75,
                  dueOffsetDays: -60,
                  tasks: [
                    { title: 'Workshop com líderes médicos', status: 'DONE', priority: 'HIGH', column: 4 },
                    { title: 'Matriz de impacto x complexidade', status: 'DONE', priority: 'MEDIUM', column: 4 },
                  ],
                },
              ],
            },
            {
              title: 'Construção dos protocolos',
              order: 2,
              status: PhaseStatus.ACTIVE,
              responsible: gerenteEnfermagem,
              startOffsetDays: -55,
              dueOffsetDays: 30,
              macroTasks: [
                {
                  title: 'Redigir protocolos de alta complexidade',
                  status: TaskStatus.IN_PROGRESS,
                  progress: 55,
                  responsible: gerenteEnfermagem,
                  startOffsetDays: -50,
                  dueOffsetDays: 15,
                  tasks: [
                    { title: 'Protocolo de Sepse', status: 'DONE', priority: 'URGENT', column: 4 },
                    { title: 'Protocolo de IAM', status: 'IN_PROGRESS', priority: 'URGENT', column: 2 },
                    { title: 'Protocolo de AVC', status: 'IN_PROGRESS', priority: 'HIGH', column: 2 },
                    { title: 'Protocolo de PCR', status: 'NOT_STARTED', priority: 'HIGH', column: 1 },
                    { title: 'Revisão científica externa', status: 'REVIEW', priority: 'MEDIUM', column: 3 },
                  ],
                },
                {
                  title: 'Validar protocolos com equipe multidisciplinar',
                  status: TaskStatus.IN_PROGRESS,
                  progress: 20,
                  responsible: gerentePS,
                  startOffsetDays: -20,
                  dueOffsetDays: 25,
                  tasks: [
                    { title: 'Reunião com Enfermagem - UEI', status: 'DONE', priority: 'MEDIUM', column: 4 },
                    { title: 'Reunião com Farmácia', status: 'IN_PROGRESS', priority: 'MEDIUM', column: 2 },
                    { title: 'Reunião com Laboratório', status: 'NOT_STARTED', priority: 'LOW', column: 1 },
                    { title: 'Bloqueado: validação Imagem', status: 'BLOCKED', priority: 'HIGH', column: 2, blocked: true },
                  ],
                },
              ],
            },
            {
              title: 'Homologação e publicação',
              order: 3,
              status: PhaseStatus.LOCKED,
              responsible: gabriel,
              startOffsetDays: 30,
              dueOffsetDays: 90,
              macroTasks: [],
            },
          ],
        },
        {
          title: 'Implantar Plano Terapêutico Multidisciplinar (PTM) como padrão',
          description:
            'PTM obrigatório em 100% das internações de alta complexidade nas 5 unidades operacionais até DEZ/2026.',
          investment: 28000,
          target: 100,
          current: 15,
          status: GoalStatus.IN_PROGRESS,
          progressPct: 15,
          phases: [
            {
              title: 'Desenho do modelo institucional',
              order: 1,
              status: PhaseStatus.ACTIVE,
              responsible: diretorOperacional,
              startOffsetDays: -30,
              dueOffsetDays: 45,
              macroTasks: [
                {
                  title: 'Construir template padrão de PTM',
                  status: TaskStatus.IN_PROGRESS,
                  progress: 40,
                  responsible: gerenteEnfermagem,
                  startOffsetDays: -25,
                  dueOffsetDays: 20,
                  tasks: [
                    { title: 'Definir campos obrigatórios', status: 'DONE', priority: 'HIGH', column: 4 },
                    { title: 'Validar com Diretoria', status: 'IN_PROGRESS', priority: 'HIGH', column: 2 },
                    { title: 'Integração com prontuário', status: 'NOT_STARTED', priority: 'MEDIUM', column: 1 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Garantir a segurança do paciente como ativo estratégico',
      description:
        'Estruturar e consolidar a cultura de segurança do paciente na Mediall Brasil, tornando notificação, análise e aprendizado com eventos adversos prática regular e integrada à governança até DEZ/2026.',
      benefits:
        'Construção real da cultura de segurança, substituindo subnotificação por aprendizado organizacional. Redução sustentada de eventos graves e judicialização.',
      responsibleUser: diretorOperacional,
      status: GoalStatus.IN_PROGRESS,
      trafficLight: TrafficLight.YELLOW,
      progressPct: 18,
      goals: [
        {
          title: 'Implantar sistema institucional de notificação de eventos adversos',
          description:
            'Meta: triplicar a taxa de notificação de near-miss em relação à linha de base 2025 até DEZ/2026.',
          investment: 35000,
          target: 300,
          current: 80,
          status: GoalStatus.AT_RISK,
          progressPct: 27,
          phases: [
            {
              title: 'Capacitação e adesão',
              order: 1,
              status: PhaseStatus.ACTIVE,
              responsible: gerenteCCIH,
              startOffsetDays: -45,
              dueOffsetDays: 30,
              macroTasks: [
                {
                  title: 'Treinar lideranças em cultura justa',
                  status: TaskStatus.IN_PROGRESS,
                  progress: 50,
                  responsible: gerenteCCIH,
                  startOffsetDays: -40,
                  dueOffsetDays: 15,
                  tasks: [
                    { title: 'Treinamento Matriz', status: 'DONE', priority: 'HIGH', column: 4 },
                    { title: 'Treinamento UEI', status: 'DONE', priority: 'HIGH', column: 4 },
                    { title: 'Treinamento HRGM', status: 'IN_PROGRESS', priority: 'HIGH', column: 2 },
                    { title: 'Treinamento HMMDO/HRPG', status: 'NOT_STARTED', priority: 'MEDIUM', column: 1 },
                    { title: 'Atrasado: pendência de sala', status: 'BLOCKED', priority: 'URGENT', column: 2, blocked: true },
                  ],
                },
                {
                  title: 'Lançar canal anônimo de notificação',
                  status: TaskStatus.REVIEW,
                  progress: 80,
                  responsible: gerenteEnfermagem,
                  startOffsetDays: -25,
                  dueOffsetDays: -5,
                  tasks: [
                    { title: 'Sistema de notificação', status: 'DONE', priority: 'HIGH', column: 4 },
                    { title: 'Material de divulgação', status: 'REVIEW', priority: 'MEDIUM', column: 3 },
                    { title: 'Política de confidencialidade', status: 'DONE', priority: 'HIGH', column: 4 },
                  ],
                },
              ],
            },
            {
              title: 'Análise sistemática e aprendizado',
              order: 2,
              status: PhaseStatus.LOCKED,
              responsible: diretorOperacional,
              startOffsetDays: 30,
              dueOffsetDays: 120,
              macroTasks: [],
            },
          ],
        },
      ],
    },
    {
      title: 'Fortalecer comissões hospitalares como instrumentos de governança',
      description:
        'Reativar e qualificar CCIH, CFT, Óbitos e Prontuários como instâncias decisórias ativas, com pauta, frequência e produtos institucionais até JUN/2026.',
      benefits:
        'Visibilidade estruturada dos riscos assistenciais. Maior credibilidade frente a auditorias, acreditações e novos contratos.',
      responsibleUser: gerenteCCIH,
      status: GoalStatus.IN_PROGRESS,
      trafficLight: TrafficLight.GREEN,
      progressPct: 45,
      goals: [
        {
          title: 'Reestruturar comissões obrigatórias em todas as unidades',
          description: 'CCIH, Comissão de Óbitos, Farmácia e Terapêutica, Revisão de Prontuários — pauta mensal e atas publicadas.',
          investment: 12000,
          target: 4,
          current: 2,
          status: GoalStatus.IN_PROGRESS,
          progressPct: 50,
          phases: [
            {
              title: 'Diagnóstico das comissões atuais',
              order: 1,
              status: PhaseStatus.ARCHIVED,
              responsible: gerenteCCIH,
              startOffsetDays: -120,
              dueOffsetDays: -80,
              completedOffsetDays: -78,
              macroTasks: [
                {
                  title: 'Levantar regimento e composição vigente',
                  status: TaskStatus.DONE,
                  progress: 100,
                  responsible: gerenteCCIH,
                  startOffsetDays: -115,
                  dueOffsetDays: -90,
                  tasks: [
                    { title: 'Regimentos UEI', status: 'DONE', priority: 'MEDIUM', column: 4 },
                    { title: 'Regimentos HRGM', status: 'DONE', priority: 'MEDIUM', column: 4 },
                    { title: 'Consolidar gaps', status: 'DONE', priority: 'HIGH', column: 4 },
                  ],
                },
              ],
            },
            {
              title: 'Reativação e calendário institucional',
              order: 2,
              status: PhaseStatus.ACTIVE,
              responsible: gerenteCCIH,
              startOffsetDays: -78,
              dueOffsetDays: 60,
              macroTasks: [
                {
                  title: 'Publicar calendário oficial 2026',
                  status: TaskStatus.DONE,
                  progress: 100,
                  responsible: gerenteCCIH,
                  startOffsetDays: -70,
                  dueOffsetDays: -50,
                  tasks: [
                    { title: 'Aprovação Diretoria', status: 'DONE', priority: 'HIGH', column: 4 },
                    { title: 'Publicação interna', status: 'DONE', priority: 'MEDIUM', column: 4 },
                  ],
                },
                {
                  title: 'Realizar 1ª rodada de reuniões',
                  status: TaskStatus.IN_PROGRESS,
                  progress: 60,
                  responsible: gerenteCCIH,
                  startOffsetDays: -45,
                  dueOffsetDays: 30,
                  tasks: [
                    { title: 'CCIH - UEI', status: 'DONE', priority: 'HIGH', column: 4 },
                    { title: 'CCIH - HRGM', status: 'DONE', priority: 'HIGH', column: 4 },
                    { title: 'CFT - todas unidades', status: 'IN_PROGRESS', priority: 'MEDIUM', column: 2 },
                    { title: 'Óbitos - HMMDO', status: 'NOT_STARTED', priority: 'MEDIUM', column: 1 },
                    { title: 'Publicar atas', status: 'IN_PROGRESS', priority: 'LOW', column: 2 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Elevar a eficiência operacional médica',
      description:
        'Consolidar a eficiência operacional médica como princípio institucional, alinhando produtividade, uso de leitos, fluxos assistenciais e tomada de decisão até DEZ/2026.',
      benefits:
        'Melhor equilíbrio entre qualidade assistencial e viabilidade econômica. Redução de desperdícios operacionais silenciosos.',
      responsibleUser: diretorFinanceiro,
      status: GoalStatus.IN_PROGRESS,
      trafficLight: TrafficLight.YELLOW,
      progressPct: 22,
      goals: [
        {
          title: 'Definir modelo padrão de produtividade médica',
          description: 'Por perfil assistencial e nível de complexidade, com aplicação contratual nas 5 unidades.',
          investment: 18000,
          target: 100,
          current: 25,
          status: GoalStatus.IN_PROGRESS,
          progressPct: 25,
          phases: [
            {
              title: 'Definição de indicadores',
              order: 1,
              status: PhaseStatus.ACTIVE,
              responsible: diretorFinanceiro,
              startOffsetDays: -40,
              dueOffsetDays: 30,
              macroTasks: [
                {
                  title: 'Definir matriz de indicadores de produtividade',
                  status: TaskStatus.IN_PROGRESS,
                  progress: 35,
                  responsible: diretorFinanceiro,
                  startOffsetDays: -35,
                  dueOffsetDays: 20,
                  tasks: [
                    { title: 'Benchmark mercado', status: 'DONE', priority: 'MEDIUM', column: 4 },
                    { title: 'Workshop com gerentes', status: 'IN_PROGRESS', priority: 'HIGH', column: 2 },
                    { title: 'Validação com Diretoria', status: 'NOT_STARTED', priority: 'HIGH', column: 1 },
                    { title: 'Documentar matriz final', status: 'NOT_STARTED', priority: 'MEDIUM', column: 1 },
                  ],
                },
                {
                  title: 'Gestão ativa de leitos e permanência',
                  status: TaskStatus.IN_PROGRESS,
                  progress: 10,
                  responsible: gerentePS,
                  startOffsetDays: -10,
                  dueOffsetDays: 45,
                  tasks: [
                    { title: 'Painel de leitos por unidade', status: 'IN_PROGRESS', priority: 'HIGH', column: 2 },
                    { title: 'Critérios de alta hospitalar', status: 'NOT_STARTED', priority: 'MEDIUM', column: 1 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'Institucionalizar a gestão orientada por dados',
      description:
        'Garantir que decisões estratégicas, táticas e operacionais sejam fundamentadas em indicadores assistenciais, operacionais, financeiros e de governança até DEZ/2026.',
      benefits:
        'Transição definitiva de gestão reativa para gestão estratégica. Identificação precoce de riscos assistenciais e contratuais.',
      responsibleUser: gabriel,
      status: GoalStatus.NOT_STARTED,
      trafficLight: TrafficLight.RED,
      progressPct: 5,
      goals: [
        {
          title: 'Painel executivo de indicadores médicos',
          description: 'Dashboard único consolidado das 5 unidades, atualização semanal, integrado ao painel da Diretoria.',
          investment: 60000,
          target: 100,
          current: 5,
          status: GoalStatus.AT_RISK,
          progressPct: 5,
          phases: [
            {
              title: 'Levantamento de fontes de dados',
              order: 1,
              status: PhaseStatus.ACTIVE,
              responsible: rafael,
              startOffsetDays: -7,
              dueOffsetDays: 60,
              macroTasks: [
                {
                  title: 'Mapear sistemas-fonte por unidade',
                  status: TaskStatus.IN_PROGRESS,
                  progress: 15,
                  responsible: rafael,
                  startOffsetDays: -5,
                  dueOffsetDays: 30,
                  tasks: [
                    { title: 'Entrevistas com gerentes', status: 'IN_PROGRESS', priority: 'HIGH', column: 2 },
                    { title: 'Inventário sistemas UEI', status: 'NOT_STARTED', priority: 'MEDIUM', column: 1 },
                    { title: 'Inventário sistemas HRGM', status: 'NOT_STARTED', priority: 'MEDIUM', column: 1 },
                    { title: 'Bloqueado: acesso ao MV', status: 'BLOCKED', priority: 'URGENT', column: 2, blocked: true },
                  ],
                },
              ],
            },
            {
              title: 'Construção do painel',
              order: 2,
              status: PhaseStatus.LOCKED,
              responsible: rafael,
              startOffsetDays: 60,
              dueOffsetDays: 180,
              macroTasks: [],
            },
          ],
        },
      ],
    },
  ]

  const now = new Date()
  const days = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000)

  const priorityMap: Record<string, Priority> = {
    LOW: Priority.LOW,
    MEDIUM: Priority.MEDIUM,
    HIGH: Priority.HIGH,
    URGENT: Priority.URGENT,
  }
  const taskStatusMap: Record<string, TaskStatus> = {
    NOT_STARTED: TaskStatus.NOT_STARTED,
    IN_PROGRESS: TaskStatus.IN_PROGRESS,
    BLOCKED: TaskStatus.BLOCKED,
    REVIEW: TaskStatus.REVIEW,
    DONE: TaskStatus.DONE,
  }

  for (const [oIdx, oDef] of objectivesDef.entries()) {
    const objective = await prisma.objective.create({
      data: {
        planId: plan.id,
        title: oDef.title,
        description: oDef.description,
        benefits: oDef.benefits,
        responsibleUserId: oDef.responsibleUser.id,
        deadline: days(365),
        status: oDef.status,
        trafficLight: oDef.trafficLight,
        progressPct: oDef.progressPct,
        unitId: MATRIZ_ID,
      },
    })
    console.log(`  ✓ Objective ${oIdx + 1}: ${oDef.title}`)

    for (const gDef of oDef.goals) {
      const goal = await prisma.goal.create({
        data: {
          objectiveId: objective.id,
          title: gDef.title,
          description: gDef.description,
          investment: gDef.investment,
          direction: Direction.UP,
          calcMethod: CalcMethod.PERCENTAGE,
          targetValue: gDef.target,
          currentValue: gDef.current,
          initialValue: 0,
          status: gDef.status,
          progressPct: gDef.progressPct,
          unitId: MATRIZ_ID,
        },
      })

      for (const phDef of gDef.phases) {
        // Each phase gets its own KanbanBoard
        const board = await prisma.kanbanBoard.create({
          data: {
            name: `${oDef.title.slice(0, 30)}… — ${phDef.title}`,
            ownerType: BoardOwner.PHASE,
            ownerId: '', // filled after phase exists; we'll just use phaseId as placeholder
            unitId: MATRIZ_ID,
            columns: { create: defaultColumns },
          },
          include: { columns: true },
        })

        const phase = await prisma.planPhase.create({
          data: {
            goalId: goal.id,
            title: phDef.title,
            order: phDef.order,
            status: phDef.status,
            unitScope: UnitScope.ALL,
            responsibleUserId: phDef.responsible.id,
            startDate: phDef.startOffsetDays != null ? days(phDef.startOffsetDays) : null,
            dueDate: phDef.dueOffsetDays != null ? days(phDef.dueOffsetDays) : null,
            completedAt: phDef.completedOffsetDays != null ? days(phDef.completedOffsetDays) : null,
            kanbanBoardId: board.id,
          },
        })

        // Update board.ownerId to phase.id
        await prisma.kanbanBoard.update({ where: { id: board.id }, data: { ownerId: phase.id } })

        let taskPosition = 1
        for (const mDef of phDef.macroTasks) {
          const macro = await prisma.macroTask.create({
            data: {
              phaseId: phase.id,
              goalId: goal.id,
              objectiveId: objective.id,
              title: mDef.title,
              responsibleUserId: mDef.responsible.id,
              unitId: MATRIZ_ID,
              startDate: mDef.startOffsetDays != null ? days(mDef.startOffsetDays) : null,
              dueDate: mDef.dueOffsetDays != null ? days(mDef.dueOffsetDays) : null,
              status: mDef.status,
              progressPct: mDef.progress,
              kanbanBoardId: board.id,
            },
          })

          for (const tDef of mDef.tasks) {
            const column = board.columns.find((c) => c.position === tDef.column)!
            await prisma.task.create({
              data: {
                boardId: board.id,
                columnId: column.id,
                macroTaskId: macro.id,
                title: tDef.title,
                responsibleUserId: mDef.responsible.id,
                createdBy: rafael.id,
                priority: priorityMap[tDef.priority],
                startDate: mDef.startOffsetDays != null ? days(mDef.startOffsetDays) : null,
                dueDate: mDef.dueOffsetDays != null ? days(mDef.dueOffsetDays) : null,
                position: taskPosition++,
                isBlocked: !!tDef.blocked,
                acceptanceStatus:
                  tDef.status === 'DONE' ? AcceptanceStatus.ACCEPTED : AcceptanceStatus.PENDING,
                unitId: MATRIZ_ID,
                completedAt: tDef.status === 'DONE' ? days(-Math.floor(Math.random() * 20)) : null,
              },
            })
          }
        }
      }
    }
  }

    console.log(`   ✓ Plan created for ${MATRIZ_ID} — ${plan.id}`)
  } // end for (TARGET_UNIT_IDS)

  // Plano 23 — tenant + tenant_id em tudo que o seed criou (raw client não passa pelo middleware).
  await ensureTenantAndBackfill(prisma)

  console.log('\n✅ Strategic seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
