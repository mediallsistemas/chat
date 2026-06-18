import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreatePlanDto } from './dto/create-plan.dto'
import { UpdatePlanDto } from './dto/update-plan.dto'
import { JwtPayload, UserRole, PlanStatus } from '@mediall/types'

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  // ─── Visões por unidade (planos ATRELADOS à unidade via PlanUnit) — plano 24.2 ───

  async findAll(unitId: string) {
    return this.prisma.strategicPlan.findMany({
      where: { deletedAt: null, units: { some: { unitId } } },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { objectives: true } },
        // status/progresso DESTA unidade (PlanUnit)
        units: { where: { unitId }, select: { status: true, progressPct: true, trafficLight: true } },
      },
    })
  }

  async findOne(unitId: string, planId: string) {
    const plan = await this.prisma.strategicPlan.findFirst({
      where: { id: planId, deletedAt: null, units: { some: { unitId } } },
      include: {
        objectives: {
          include: { _count: { select: { goals: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!plan) throw new NotFoundException('Plano não encontrado.')
    return plan
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
    return this.prisma.strategicPlan.update({ where: { id: planId }, data: { status: PlanStatus.ACTIVE } })
  }

  async archive(unitId: string, planId: string) {
    await this.findOne(unitId, planId)
    return this.prisma.strategicPlan.update({ where: { id: planId }, data: { status: PlanStatus.ARCHIVED } })
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

    // NOTE (24.3): fan-out de PhaseScopeBoard por unidade ainda não é feito aqui.
    return Promise.all(
      unitIds.map((unitId) =>
        this.prisma.planUnit.upsert({
          where: { planId_unitId: { planId, unitId } },
          update: {},
          create: { planId, unitId, status: plan.status, attachedBy: user.sub },
        }),
      ),
    )
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
    await this.prisma.planUnit.deleteMany({ where: { planId, unitId } })
    return { detached: true }
    // NOTE (24.3): limpeza dos boards/tarefas daquela unidade ainda não é feita aqui.
  }

  /** Exclui o plano para TODAS as unidades (soft-delete). */
  async softDelete(planId: string) {
    await this.assertPlan(planId)
    await this.prisma.strategicPlan.update({ where: { id: planId }, data: { deletedAt: new Date() } })
    return { deleted: true }
  }
}
