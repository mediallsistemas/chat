import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { EventBusService } from '../../../shared/events'
import { PlanStatusChangedEvent } from './events/plan-status-changed.event'
import { CreatePlanDto } from './dto/create-plan.dto'
import { UpdatePlanDto } from './dto/update-plan.dto'
import {
  JwtPayload,
  UserRole,
  PlanStatus,
  GoalStatus,
  PhaseStatus,
  TrafficLight,
  TaskStatus,
  BoardOwner,
} from '@mediall/types'

@Injectable()
export class PlansService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  // ─── Visões por unidade (planos ATRELADOS à unidade via PlanUnit) — plano 24.2 ───

  async findAll(unitId: string) {
    // Mantém o cache de progresso/farol DESTA unidade fresco antes de devolver.
    const planIds = (
      await this.prisma.strategicPlan.findMany({
        where: { deletedAt: null, units: { some: { unitId } } },
        select: { id: true },
      })
    ).map((p) => p.id)
    for (const planId of planIds) await this.recalcPlanUnit(planId, unitId)

    return this.prisma.strategicPlan.findMany({
      where: { deletedAt: null, units: { some: { unitId } } },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: {
        // Cada unidade tem sua própria árvore (execução por unidade) — conte só os objetivos DESTA unidade.
        _count: { select: { objectives: { where: { unitId } } } },
        // status/progresso DESTA unidade (PlanUnit)
        units: { where: { unitId }, select: { status: true, progressPct: true, trafficLight: true } },
      },
    })
  }

  async findOne(unitId: string, planId: string) {
    const plan = await this.prisma.strategicPlan.findFirst({
      where: { id: planId, deletedAt: null, units: { some: { unitId } } },
      include: {
        // Só os objetivos DESTA unidade (execução por unidade — plano 24.3).
        objectives: {
          where: { unitId },
          include: { _count: { select: { goals: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!plan) throw new NotFoundException('Plano não encontrado.')
    return plan
  }

  /**
   * Strategic panel for a unit: the unit's plans with their objectives, goals and
   * ACTIVE phases, plus the headline counts. Scoped to this unit's own execution
   * tree (objectives/goals are per-unit). Shape matches the frontend
   * `StrategicPanelData`.
   */
  async getPanel(unitId: string) {
    const now = new Date()
    const plans = await this.prisma.strategicPlan.findMany({
      where: { deletedAt: null, units: { some: { unitId } } },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: {
        objectives: {
          where: { unitId },
          orderBy: { createdAt: 'asc' },
          include: {
            goals: {
              orderBy: { createdAt: 'asc' },
              include: {
                phases: {
                  where: { status: PhaseStatus.ACTIVE },
                  orderBy: { order: 'asc' },
                  include: { _count: { select: { macroTasks: true } } },
                },
              },
            },
          },
        },
      },
    })

    const objectives = plans.flatMap((p) => p.objectives)
    const goals = objectives.flatMap((o) => o.goals)
    const phases = goals.flatMap((g) => g.phases)

    const blockedMacroTasks = await this.prisma.macroTask.count({
      where: { unitId, status: TaskStatus.BLOCKED },
    })

    return {
      activePlansCount: plans.filter((p) => p.status === PlanStatus.ACTIVE).length,
      totalObjectives: objectives.length,
      doneObjectives: objectives.filter((o) => o.status === GoalStatus.DONE).length,
      activePhasesCount: phases.length,
      blockedMacroTasks,
      atRiskGoals: goals.filter((g) => g.status === GoalStatus.AT_RISK).length,
      overduePhases: phases.filter((ph) => ph.dueDate != null && ph.dueDate < now).length,
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        year: p.year,
        status: p.status,
        objectives: p.objectives.map((o) => ({
          id: o.id,
          title: o.title,
          progressPct: Number(o.progressPct),
          trafficLight: o.trafficLight,
          status: o.status,
          goals: o.goals.map((g) => ({
            id: g.id,
            title: g.title,
            progressPct: Number(g.progressPct),
            status: g.status,
            phases: g.phases.map((ph) => ({
              id: ph.id,
              title: ph.title,
              status: ph.status,
              dueDate: ph.dueDate ? ph.dueDate.toISOString() : null,
              _count: { macroTasks: ph._count.macroTasks },
            })),
          })),
        })),
      })),
    }
  }

  async create(unitId: string, dto: CreatePlanDto, user: JwtPayload) {
    if (![UserRole.SUPER_ADMIN, UserRole.DIRETORIA].includes(user.role)) {
      throw new ForbiddenException('Apenas Diretoria pode criar planos estratégicos.')
    }

    const status = dto.status ?? PlanStatus.DRAFT
    const plan = await this.prisma.strategicPlan.create({
      data: { ...dto, unitId, createdBy: user.sub, status },
    })
    // Atrela o plano à unidade de criação (execução por unidade).
    await this.prisma.planUnit.create({
      data: { planId: plan.id, unitId, status, attachedBy: user.sub },
    })
    return plan
  }

  async update(unitId: string, planId: string, dto: UpdatePlanDto) {
    await this.findOne(unitId, planId) // valida acesso/tenant antes do update por id
    return this.prisma.strategicPlan.update({ where: { id: planId }, data: dto })
  }

  async activate(unitId: string, planId: string) {
    await this.findOne(unitId, planId)
    const plan = await this.prisma.strategicPlan.update({
      where: { id: planId },
      data: { status: PlanStatus.ACTIVE },
    })
    // Refresh the Jarvis panel in real time for this unit (plano 25.6).
    this.eventBus.publish(new PlanStatusChangedEvent(planId, [unitId], 'activated'))
    return plan
  }

  async archive(unitId: string, planId: string) {
    await this.findOne(unitId, planId)
    const plan = await this.prisma.strategicPlan.update({
      where: { id: planId },
      data: { status: PlanStatus.ARCHIVED },
    })
    this.eventBus.publish(new PlanStatusChangedEvent(planId, [unitId], 'archived'))
    return plan
  }

  // ─── Definição + atribuição tenant-wide (admin) — plano 24.2 ───

  /** Confirma que o plano existe NESTE tenant (findFirst é auto-escopado por tenant). */
  private async assertPlan(planId: string) {
    const plan = await this.prisma.strategicPlan.findFirst({ where: { id: planId, deletedAt: null } })
    if (!plan) throw new NotFoundException('Plano não encontrado.')
    return plan
  }

  /** Todos os planos do tenant, com as unidades atreladas (visão holding). */
  async findAllForTenant() {
    return this.prisma.strategicPlan.findMany({
      where: { deletedAt: null },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { objectives: true } },
        units: { include: { unit: { select: { id: true, name: true, type: true } } } },
      },
    })
  }

  async listUnits(planId: string) {
    await this.assertPlan(planId)
    // Atualiza o cache de progresso/farol por unidade antes de devolver (write-through).
    const links = await this.prisma.planUnit.findMany({ where: { planId }, select: { unitId: true } })
    for (const { unitId } of links) await this.recalcPlanUnit(planId, unitId)
    return this.prisma.planUnit.findMany({
      where: { planId },
      include: { unit: { select: { id: true, name: true, type: true } } },
      orderBy: { attachedAt: 'asc' },
    })
  }

  /** Atrela o plano a N unidades (idempotente). Valida que as unidades são do tenant. */
  async attachUnits(planId: string, unitIds: string[], user: JwtPayload) {
    const plan = await this.assertPlan(planId)

    // findMany é auto-escopado por tenant → só retorna unidades DESTE tenant.
    const valid = await this.prisma.unit.findMany({
      where: { id: { in: unitIds }, isActive: true },
      select: { id: true },
    })
    const found = new Set(valid.map((u) => u.id))
    const invalid = unitIds.filter((id) => !found.has(id))
    if (invalid.length) {
      throw new BadRequestException('Uma ou mais unidades são inválidas para esta organização.')
    }

    // 24.3 — Fan-out da execução por unidade: cada unidade nova ganha a estrutura
    // do plano (objetivos/metas/etapas/boards/macro), clonada da unidade de origem
    // com a EXECUÇÃO ZERADA (1ª etapa ACTIVE, demais LOCKED; sem tarefas). A unidade
    // executa a sua própria cópia sem afetar as outras. Idempotente.
    for (const unitId of unitIds) {
      const already = await this.prisma.planUnit.findFirst({ where: { planId, unitId } })
      if (already) continue

      await this.prisma.planUnit.create({
        data: { tenantId: plan.tenantId, planId, unitId, status: plan.status, attachedBy: user.sub },
      })

      // A unidade de origem já possui a estrutura — só clonamos para as demais.
      if (unitId !== plan.unitId) {
        await this.cloneSubtreeForUnit(planId, plan.tenantId, plan.unitId, unitId)
      }
      await this.recalcPlanUnit(planId, unitId)
    }

    return this.listUnits(planId)
  }

  /** Desatrela o plano de UMA unidade (não permite remover a última). */
  async detachUnit(planId: string, unitId: string) {
    await this.assertPlan(planId)
    const total = await this.prisma.planUnit.count({ where: { planId } })
    if (total <= 1) {
      throw new BadRequestException(
        'Não é possível remover a última unidade do plano. Exclua o plano (geral).',
      )
    }
    // Derruba a execução daquela unidade (boards/tarefas/macro/etapas/metas/objetivos
    // DESTE plano e DESTA unidade) — as outras unidades seguem intactas.
    await this.deleteUnitSubtree(planId, unitId)
    await this.prisma.planUnit.deleteMany({ where: { planId, unitId } })
    return { detached: true }
  }

  /** Exclui o plano para TODAS as unidades (soft-delete). */
  async softDelete(planId: string) {
    await this.assertPlan(planId)
    // Capture every unit the plan touched so the panel refreshes for all of them.
    const links = await this.prisma.planUnit.findMany({ where: { planId }, select: { unitId: true } })
    await this.prisma.strategicPlan.update({ where: { id: planId }, data: { deletedAt: new Date() } })
    this.eventBus.publish(
      new PlanStatusChangedEvent(planId, links.map((l) => l.unitId), 'deleted'),
    )
    return { deleted: true }
  }

  // ─── Execução por unidade (fan-out / cleanup / progresso) — plano 24.3 ───

  /**
   * Clona a estrutura do plano (objetivos → metas → etapas + board/colunas → macro)
   * da unidade de origem para `targetUnitId`, com a execução ZERADA: 1ª etapa ACTIVE,
   * demais LOCKED; progresso 0; sem tarefas (cada unidade executa do zero). Sequencial
   * (sem transação) — ação administrativa; re-attach é idempotente no chamador.
   */
  private async cloneSubtreeForUnit(
    planId: string,
    tenantId: string | null,
    sourceUnitId: string,
    targetUnitId: string,
  ) {
    const objectives = await this.prisma.objective.findMany({
      where: { planId, unitId: sourceUnitId },
      orderBy: { createdAt: 'asc' },
      include: {
        goals: {
          orderBy: { createdAt: 'asc' },
          include: {
            phases: {
              orderBy: { order: 'asc' },
              include: {
                kanbanBoard: { include: { columns: { orderBy: { position: 'asc' } } } },
                macroTasks: { orderBy: { createdAt: 'asc' } },
              },
            },
          },
        },
      },
    })

    for (const obj of objectives) {
      const newObjective = await this.prisma.objective.create({
        data: {
          tenantId,
          planId,
          unitId: targetUnitId,
          title: obj.title,
          description: obj.description,
          benefits: obj.benefits,
          responsibleSectorId: obj.responsibleSectorId,
          responsibleUserId: obj.responsibleUserId,
          deadline: obj.deadline,
          groupId: obj.groupId,
          status: GoalStatus.NOT_STARTED,
          progressPct: 0,
          trafficLight: TrafficLight.GREEN,
        },
      })

      for (const goal of obj.goals) {
        const newGoal = await this.prisma.goal.create({
          data: {
            tenantId,
            objectiveId: newObjective.id,
            unitId: targetUnitId,
            title: goal.title,
            description: goal.description,
            sectorId: goal.sectorId,
            investment: goal.investment,
            direction: goal.direction,
            calcMethod: goal.calcMethod,
            targetValue: goal.targetValue,
            initialValue: goal.initialValue,
            currentValue: 0,
            status: GoalStatus.NOT_STARTED,
            progressPct: 0,
          },
        })

        for (const phase of goal.phases) {
          const board = await this.prisma.kanbanBoard.create({
            data: {
              tenantId,
              name: phase.kanbanBoard.name,
              ownerType: BoardOwner.PHASE,
              ownerId: '',
              unitId: targetUnitId,
              columns: {
                create: phase.kanbanBoard.columns.map((c) => ({
                  tenantId,
                  name: c.name,
                  position: c.position,
                  wipLimit: c.wipLimit,
                  isDoneColumn: c.isDoneColumn,
                  color: c.color,
                })),
              },
            },
          })

          const newPhase = await this.prisma.planPhase.create({
            data: {
              tenantId,
              goalId: newGoal.id,
              title: phase.title,
              description: phase.description,
              order: phase.order,
              status: phase.order === 1 ? PhaseStatus.ACTIVE : PhaseStatus.LOCKED,
              unitScope: phase.unitScope,
              unitId: phase.unitId,
              responsibleUserId: phase.responsibleUserId,
              startDate: phase.startDate,
              dueDate: phase.dueDate,
              completedAt: null,
              kanbanBoardId: board.id,
            },
          })

          await this.prisma.kanbanBoard.update({
            where: { id: board.id },
            data: { ownerId: newPhase.id },
          })

          for (const macro of phase.macroTasks) {
            await this.prisma.macroTask.create({
              data: {
                tenantId,
                phaseId: newPhase.id,
                goalId: newGoal.id,
                objectiveId: newObjective.id,
                title: macro.title,
                description: macro.description,
                responsibleUserId: macro.responsibleUserId,
                sectorId: macro.sectorId,
                unitId: targetUnitId,
                startDate: macro.startDate,
                dueDate: macro.dueDate,
                status: TaskStatus.NOT_STARTED,
                progressPct: 0,
                groupId: macro.groupId,
                kanbanBoardId: board.id,
              },
            })
          }
        }
      }
    }
  }

  /**
   * Remove a execução do plano numa unidade: tarefas (e filhas), macro-tarefas,
   * etapas + boards/colunas, metas e objetivos DAQUELE plano e DAQUELA unidade.
   * As demais unidades do plano não são tocadas.
   */
  private async deleteUnitSubtree(planId: string, unitId: string) {
    const objectives = await this.prisma.objective.findMany({
      where: { planId, unitId },
      select: { id: true, goals: { select: { id: true, phases: { select: { id: true, kanbanBoardId: true } } } } },
    })
    if (!objectives.length) return

    const objectiveIds = objectives.map((o) => o.id)
    const goalIds = objectives.flatMap((o) => o.goals.map((g) => g.id))
    const phases = objectives.flatMap((o) => o.goals.flatMap((g) => g.phases))
    const phaseIds = phases.map((p) => p.id)

    const boardIds = new Set<string>(phases.map((p) => p.kanbanBoardId))
    // Macro-tarefas podem ter board próprio (criadas em runtime) — incluir esses boards.
    const macros = await this.prisma.macroTask.findMany({
      where: { phaseId: { in: phaseIds } },
      select: { kanbanBoardId: true },
    })
    macros.forEach((m) => boardIds.add(m.kanbanBoardId))
    const allBoardIds = [...boardIds]

    const taskIds = (
      await this.prisma.task.findMany({ where: { boardId: { in: allBoardIds } }, select: { id: true } })
    ).map((t) => t.id)

    if (taskIds.length) {
      await this.prisma.taskDependency.deleteMany({
        where: { OR: [{ taskId: { in: taskIds } }, { dependsOnId: { in: taskIds } }] },
      })
      await this.prisma.taskImpediment.deleteMany({ where: { taskId: { in: taskIds } } })
      await this.prisma.taskChecklist.deleteMany({ where: { taskId: { in: taskIds } } })
      await this.prisma.taskFile.deleteMany({ where: { taskId: { in: taskIds } } })
    }

    await this.prisma.task.deleteMany({ where: { boardId: { in: allBoardIds } } })
    await this.prisma.macroTask.deleteMany({ where: { phaseId: { in: phaseIds } } })
    await this.prisma.phaseScopeBoard.deleteMany({ where: { phaseId: { in: phaseIds } } })
    await this.prisma.planPhase.deleteMany({ where: { id: { in: phaseIds } } })
    await this.prisma.kanbanColumn.deleteMany({ where: { boardId: { in: allBoardIds } } })
    await this.prisma.kanbanBoard.deleteMany({ where: { id: { in: allBoardIds } } })
    await this.prisma.goal.deleteMany({ where: { id: { in: goalIds } } })
    await this.prisma.objective.deleteMany({ where: { id: { in: objectiveIds } } })
  }

  /** Recalcula o cache de progresso/farol por unidade no PlanUnit (derivado dos objetivos). */
  private async recalcPlanUnit(planId: string, unitId: string) {
    const objectives = await this.prisma.objective.findMany({
      where: { planId, unitId },
      select: { progressPct: true, trafficLight: true },
    })
    const progressPct = objectives.length
      ? objectives.reduce((sum, o) => sum + Number(o.progressPct), 0) / objectives.length
      : 0
    const trafficLight = objectives.some((o) => o.trafficLight === TrafficLight.RED)
      ? TrafficLight.RED
      : objectives.some((o) => o.trafficLight === TrafficLight.YELLOW)
        ? TrafficLight.YELLOW
        : TrafficLight.GREEN

    await this.prisma.planUnit.updateMany({ where: { planId, unitId }, data: { progressPct, trafficLight } })
  }
}
