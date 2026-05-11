import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreatePlanDto } from './dto/create-plan.dto'
import { UpdatePlanDto } from './dto/update-plan.dto'
import { JwtPayload, UserRole, PlanStatus } from '@mediall/types'

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  async findAll(unitId: string) {
    return this.prisma.strategicPlan.findMany({
      where: { unitId },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { objectives: true } },
      },
    })
  }

  async findOne(unitId: string, planId: string) {
    const plan = await this.prisma.strategicPlan.findFirst({
      where: { id: planId, unitId },
      include: {
        objectives: {
          include: {
            _count: { select: { goals: true } },
          },
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

    return this.prisma.strategicPlan.create({
      data: {
        ...dto,
        unitId,
        createdBy: user.sub,
        status: dto.status ?? PlanStatus.DRAFT,
      },
    })
  }

  async update(unitId: string, planId: string, dto: UpdatePlanDto) {
    await this.findOne(unitId, planId)
    return this.prisma.strategicPlan.update({
      where: { id: planId },
      data: dto,
    })
  }

  async activate(unitId: string, planId: string) {
    await this.findOne(unitId, planId)
    return this.prisma.strategicPlan.update({
      where: { id: planId },
      data: { status: PlanStatus.ACTIVE },
    })
  }

  async archive(unitId: string, planId: string) {
    await this.findOne(unitId, planId)
    return this.prisma.strategicPlan.update({
      where: { id: planId },
      data: { status: PlanStatus.ARCHIVED },
    })
  }
}
