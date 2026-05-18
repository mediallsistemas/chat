import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateObjectiveDto } from './dto/create-objective.dto'
import { UpdateObjectiveDto } from './dto/update-objective.dto'
import { JwtPayload, TrafficLight, GoalStatus } from '@mediall/types'

@Injectable()
export class ObjectivesService {
  constructor(private prisma: PrismaService) {}

  async findAll(unitId: string, planId: string) {
    return this.prisma.objective.findMany({
      where: { planId, unitId },
      include: {
        goals: { select: { id: true, title: true, progressPct: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async create(unitId: string, planId: string, dto: CreateObjectiveDto, user: JwtPayload) {
    return this.prisma.objective.create({
      data: {
        ...dto,
        deadline: new Date(dto.deadline),
        planId,
        unitId,
        status: GoalStatus.NOT_STARTED,
        trafficLight: TrafficLight.GREEN,
      },
    })
  }

  async update(unitId: string, planId: string, objectiveId: string, dto: UpdateObjectiveDto) {
    const exists = await this.prisma.objective.findFirst({ where: { id: objectiveId, planId, unitId } })
    if (!exists) throw new NotFoundException('Objetivo não encontrado.')
    return this.prisma.objective.update({
      where: { id: objectiveId },
      data: {
        ...dto,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      },
    })
  }

  async recalculateProgress(objectiveId: string) {
    const goals = await this.prisma.goal.findMany({
      where: { objectiveId },
      select: { progressPct: true },
    })

    if (goals.length === 0) return

    const avg = goals.reduce((sum, g) => sum + Number(g.progressPct), 0) / goals.length
    const trafficLight =
      avg >= 70 ? TrafficLight.GREEN : avg >= 40 ? TrafficLight.YELLOW : TrafficLight.RED

    await this.prisma.objective.update({
      where: { id: objectiveId },
      data: { progressPct: avg, trafficLight },
    })
  }
}
