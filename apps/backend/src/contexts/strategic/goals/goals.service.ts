import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateGoalDto } from './dto/create-goal.dto'
import { UpdateGoalDto } from './dto/update-goal.dto'
import { ObjectivesService } from '../objectives/objectives.service'
import { JwtPayload, GoalStatus } from '@mediall/types'

@Injectable()
export class GoalsService {
  constructor(
    private prisma: PrismaService,
    private objectivesService: ObjectivesService,
  ) {}

  async findAll(unitId: string, objectiveId: string) {
    return this.prisma.goal.findMany({
      where: { objectiveId, unitId },
      include: {
        phases: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            order: true,
            kanbanBoardId: true,
            responsibleUserId: true,
            unitScope: true,
            startDate: true,
            dueDate: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    })
  }

  async create(unitId: string, objectiveId: string, dto: CreateGoalDto, user: JwtPayload) {
    const goal = await this.prisma.goal.create({
      data: {
        ...dto,
        objectiveId,
        unitId,
        initialValue: dto.initialValue ?? 0,
        status: GoalStatus.NOT_STARTED,
      },
    })

    return goal
  }

  async update(unitId: string, objectiveId: string, goalId: string, dto: UpdateGoalDto) {
    const exists = await this.prisma.goal.findFirst({ where: { id: goalId, objectiveId, unitId } })
    if (!exists) throw new NotFoundException('Meta não encontrada.')
    return this.prisma.goal.update({ where: { id: goalId }, data: dto })
  }

  async recalculateProgress(goalId: string) {
    const phases = await this.prisma.planPhase.findMany({
      where: { goalId },
      select: { status: true },
    })

    if (phases.length === 0) return

    const completed = phases.filter((p) => p.status === 'ARCHIVED').length
    const progressPct = (completed / phases.length) * 100

    const goal = await this.prisma.goal.update({
      where: { id: goalId },
      data: { progressPct, currentValue: progressPct },
      select: { objectiveId: true },
    })

    await this.objectivesService.recalculateProgress(goal.objectiveId)
  }
}
