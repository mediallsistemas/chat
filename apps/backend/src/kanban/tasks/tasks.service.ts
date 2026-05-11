import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateTaskDto } from './dto/create-task.dto'
import { MoveTaskDto } from './dto/move-task.dto'
import { JwtPayload, AcceptanceStatus } from '@mediall/types'

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async findByBoard(unitId: string, boardId: string) {
    return this.prisma.kanbanBoard.findFirst({
      where: { id: boardId, unitId },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              where: { completedAt: null },
              orderBy: { position: 'asc' },
              include: {
                _count: { select: { impediments: true, checklists: true } },
              },
            },
          },
        },
      },
    })
  }

  async create(unitId: string, dto: CreateTaskDto, user: JwtPayload) {
    const lastTask = await this.prisma.task.findFirst({
      where: { columnId: dto.columnId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })

    return this.prisma.task.create({
      data: {
        boardId: dto.boardId,
        columnId: dto.columnId,
        macroTaskId: dto.macroTaskId,
        title: dto.title,
        description: dto.description,
        responsibleUserId: dto.responsibleUserId,
        createdBy: user.sub,
        priority: dto.priority ?? 'MEDIUM',
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        estimatedHours: dto.estimatedHours,
        position: (lastTask?.position ?? 0) + 1,
        unitId,
      },
    })
  }

  async move(unitId: string, taskId: string, dto: MoveTaskDto) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, unitId } })
    if (!task) throw new NotFoundException('Tarefa não encontrada.')

    const targetColumn = await this.prisma.kanbanColumn.findUnique({ where: { id: dto.columnId } })

    if (targetColumn?.isDoneColumn) {
      if (task.isBlocked) {
        throw new BadRequestException('Tarefa bloqueada não pode ser movida para Concluído.')
      }

      // Check that all dependencies are done
      const openDeps = await this.prisma.taskDependency.findMany({
        where: { taskId, dependsOn: { completedAt: null } },
        select: { dependsOn: { select: { title: true } } },
      })
      if (openDeps.length > 0) {
        throw new BadRequestException(
          `Existem ${openDeps.length} dependência(s) não concluída(s).`,
        )
      }
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        columnId: dto.columnId,
        position: dto.position,
        completedAt: undefined,
      },
    })
  }

  async accept(unitId: string, taskId: string, user: JwtPayload) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, unitId } })
    if (!task) throw new NotFoundException('Tarefa não encontrada.')
    if (task.responsibleUserId !== user.sub) {
      throw new BadRequestException('Somente o responsável pode aceitar a tarefa.')
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { acceptanceStatus: AcceptanceStatus.ACCEPTED },
    })
  }

  async decline(unitId: string, taskId: string, user: JwtPayload) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, unitId } })
    if (!task) throw new NotFoundException('Tarefa não encontrada.')
    if (task.responsibleUserId !== user.sub) {
      throw new BadRequestException('Somente o responsável pode recusar a tarefa.')
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { acceptanceStatus: AcceptanceStatus.DECLINED },
    })
  }

  async findOne(unitId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, unitId },
      include: {
        checklists: { orderBy: { createdAt: 'asc' } },
        dependencies: {
          include: { dependsOn: { select: { id: true, title: true, columnId: true } } },
        },
      },
    })
    if (!task) throw new NotFoundException('Tarefa não encontrada.')
    return task
  }

  async addChecklistItem(unitId: string, taskId: string, description: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, unitId } })
    if (!task) throw new NotFoundException('Tarefa não encontrada.')

    return this.prisma.taskChecklist.create({ data: { taskId, description } })
  }

  async toggleChecklistItem(unitId: string, taskId: string, checklistId: string) {
    const item = await this.prisma.taskChecklist.findFirst({
      where: { id: checklistId, task: { id: taskId, unitId } },
    })
    if (!item) throw new NotFoundException('Item não encontrado.')

    return this.prisma.taskChecklist.update({
      where: { id: checklistId },
      data: { isDone: !item.isDone },
    })
  }

  async deleteChecklistItem(unitId: string, taskId: string, checklistId: string) {
    const item = await this.prisma.taskChecklist.findFirst({
      where: { id: checklistId, task: { id: taskId, unitId } },
    })
    if (!item) throw new NotFoundException('Item não encontrado.')

    return this.prisma.taskChecklist.delete({ where: { id: checklistId } })
  }

  async addDependency(unitId: string, taskId: string, dependsOnId: string) {
    if (taskId === dependsOnId) {
      throw new BadRequestException('Uma tarefa não pode depender de si mesma.')
    }

    // Verify both tasks belong to this unit
    const [task, dep] = await Promise.all([
      this.prisma.task.findFirst({ where: { id: taskId, unitId } }),
      this.prisma.task.findFirst({ where: { id: dependsOnId, unitId } }),
    ])
    if (!task || !dep) throw new NotFoundException('Tarefa não encontrada.')

    // Prevent circular dependency: check if dependsOnId already depends (directly or transitively) on taskId
    const visited = new Set<string>()
    const hasCycle = async (currentId: string): Promise<boolean> => {
      if (visited.has(currentId)) return false
      visited.add(currentId)
      const deps = await this.prisma.taskDependency.findMany({
        where: { taskId: currentId },
        select: { dependsOnId: true },
      })
      for (const d of deps) {
        if (d.dependsOnId === taskId) return true
        if (await hasCycle(d.dependsOnId)) return true
      }
      return false
    }

    if (await hasCycle(dependsOnId)) {
      throw new BadRequestException('Adicionar esta dependência criaria um ciclo.')
    }

    return this.prisma.taskDependency.create({ data: { taskId, dependsOnId } })
  }

  async removeDependency(unitId: string, taskId: string, dependsOnId: string) {
    const dep = await this.prisma.taskDependency.findFirst({
      where: { taskId, dependsOnId, task: { unitId } },
    })
    if (!dep) throw new NotFoundException('Dependência não encontrada.')

    return this.prisma.taskDependency.delete({ where: { id: dep.id } })
  }

  async search(unitId: string, q: string) {
    if (!q || q.trim().length < 2) return []
    return this.prisma.task.findMany({
      where: {
        unitId,
        completedAt: null,
        title: { contains: q.trim(), mode: 'insensitive' },
      },
      select: { id: true, title: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    })
  }
}
