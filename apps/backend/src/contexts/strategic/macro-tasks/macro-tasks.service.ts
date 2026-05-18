import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { CreateMacroTaskDto } from './dto/create-macro-task.dto'
import { JwtPayload, BoardOwner, TaskStatus } from '@mediall/types'

@Injectable()
export class MacroTasksService {
  constructor(private prisma: PrismaService) {}

  async findAll(unitId: string, phaseId: string) {
    return this.prisma.macroTask.findMany({
      where: { phaseId, unitId },
      include: {
        kanbanBoard: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async create(unitId: string, phaseId: string, dto: CreateMacroTaskDto, user: JwtPayload) {
    const phase = await this.prisma.planPhase.findFirst({
      where: { id: phaseId },
      include: { goal: { select: { id: true, objectiveId: true } } },
    })

    if (!phase) throw new NotFoundException('Etapa não encontrada.')

    const board = await this.prisma.kanbanBoard.create({
      data: {
        name: dto.title,
        ownerType: BoardOwner.MACRO_TASK,
        ownerId: phaseId,
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

    return this.prisma.macroTask.create({
      data: {
        phaseId,
        goalId: phase.goal.id,
        objectiveId: phase.goal.objectiveId,
        title: dto.title,
        description: dto.description,
        responsibleUserId: dto.responsibleUserId,
        sectorId: dto.sectorId,
        unitId,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        groupId: dto.groupId,
        status: TaskStatus.NOT_STARTED,
        kanbanBoardId: board.id,
      },
      include: { kanbanBoard: true },
    })
  }
}
