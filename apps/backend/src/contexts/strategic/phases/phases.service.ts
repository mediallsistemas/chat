import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { EventBusService } from '../../shared/events'
import { PhaseCompletedEvent } from './events/phase-completed.event'
import { PhaseUnlockedEvent } from './events/phase-unlocked.event'
import { CreatePhaseDto } from './dto/create-phase.dto'
import { UpdatePhaseDto } from './dto/update-phase.dto'
import { GoalsService } from '../goals/goals.service'
import { JwtPayload, PhaseStatus, BoardOwner } from '@mediall/types'

@Injectable()
export class PhasesService {
  constructor(
    private prisma: PrismaService,
    private goalsService: GoalsService,
    private eventBus: EventBusService,
  ) {}

  async findAll(unitId: string, goalId: string) {
    return this.prisma.planPhase.findMany({
      where: { goalId },
      include: {
        kanbanBoard: { select: { id: true, name: true } },
        _count: { select: { macroTasks: true } },
      },
      orderBy: { order: 'asc' },
    })
  }

  async create(unitId: string, goalId: string, dto: CreatePhaseDto, user: JwtPayload) {
    // Auto-create a kanban board for this phase
    const board = await this.prisma.kanbanBoard.create({
      data: {
        name: dto.title,
        ownerType: BoardOwner.PHASE,
        ownerId: goalId,
        unitId,
        columns: {
          create: [
            { name: 'Backlog', position: 1 },
            { name: 'Em andamento', position: 2 },
            { name: 'Impedido', position: 3 },
            { name: 'Em revisão', position: 4 },
            { name: 'Concluído', position: 5, isDoneColumn: true },
          ],
        },
      },
    })

    // Only the first phase starts as ACTIVE; rest are LOCKED
    const existingCount = await this.prisma.planPhase.count({ where: { goalId } })
    const status = existingCount === 0 ? PhaseStatus.ACTIVE : PhaseStatus.LOCKED

    return this.prisma.planPhase.create({
      data: {
        goalId,
        title: dto.title,
        description: dto.description,
        order: dto.order,
        status,
        unitScope: dto.unitScope ?? 'ALL',
        unitId: dto.unitId,
        responsibleUserId: dto.responsibleUserId,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        kanbanBoardId: board.id,
      },
      include: { kanbanBoard: true },
    })
  }

  async update(unitId: string, goalId: string, phaseId: string, dto: UpdatePhaseDto) {
    const exists = await this.prisma.planPhase.findFirst({ where: { id: phaseId, goalId } })
    if (!exists) throw new NotFoundException('Etapa não encontrada.')
    return this.prisma.planPhase.update({
      where: { id: phaseId },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    })
  }

  async complete(unitId: string, phaseId: string) {
    const phase = await this.prisma.planPhase.findFirst({
      where: { id: phaseId },
      include: { goal: { select: { unitId: true } } },
    })

    if (!phase) throw new NotFoundException('Etapa não encontrada.')
    if (phase.status !== PhaseStatus.ACTIVE) {
      throw new BadRequestException('Somente etapas ACTIVE podem ser concluídas.')
    }

    const effectiveUnitId = phase.unitId ?? phase.goal.unitId

    // Archive current phase
    await this.prisma.planPhase.update({
      where: { id: phaseId },
      data: { status: PhaseStatus.ARCHIVED, completedAt: new Date() },
    })

    this.eventBus.publish(
      new PhaseCompletedEvent(phaseId, phase.title, phase.goalId, effectiveUnitId, phase.responsibleUserId),
    )

    // Unlock the next phase in sequence
    const nextPhase = await this.prisma.planPhase.findFirst({
      where: { goalId: phase.goalId, order: phase.order + 1, status: PhaseStatus.LOCKED },
    })

    if (nextPhase) {
      await this.prisma.planPhase.update({
        where: { id: nextPhase.id },
        data: { status: PhaseStatus.ACTIVE },
      })

      this.eventBus.publish(
        new PhaseUnlockedEvent(nextPhase.id, nextPhase.title, nextPhase.goalId, effectiveUnitId, nextPhase.responsibleUserId),
      )
    }

    // Recalculate goal progress bottom-up
    await this.goalsService.recalculateProgress(phase.goalId)

    return { archived: phaseId, unlocked: nextPhase?.id ?? null }
  }
}
