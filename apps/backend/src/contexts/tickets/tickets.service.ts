import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { EventBusService } from '../../shared/events'
import { TicketAssignedEvent } from './events/ticket-assigned.event'
import { TicketStatusChangedEvent } from './events/ticket-status-changed.event'
import { CreateTicketDto } from './dto/create-ticket.dto'
import { UpdateTicketDto } from './dto/update-ticket.dto'
import { JwtPayload, TicketStatus } from '@mediall/types'
import { paginate } from '../../common/utils/paginate'
import { PaginationDto } from '../../common/dto/pagination.dto'

const INCLUDE_TICKET = {
  reporter: { select: { id: true, name: true, avatarUrl: true } },
  assignee: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { comments: true } },
} as const

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async findAll(unitId: string, status?: TicketStatus, pagination?: PaginationDto) {
    return paginate(
      this.prisma.ticket,
      {
        where: { unitId, ...(status ? { status } : {}) },
        include: INCLUDE_TICKET,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      },
      { limit: pagination?.limit, offset: pagination?.offset },
    )
  }

  async findOne(unitId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, unitId },
      include: {
        ...INCLUDE_TICKET,
        comments: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!ticket) throw new NotFoundException('Chamado não encontrado.')
    return ticket
  }

  async create(unitId: string, dto: CreateTicketDto, user: JwtPayload) {
    const ticket = await this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'MEDIUM',
        category: dto.category ?? null,
        unitId,
        reportedBy: user.sub,
        assignedTo: dto.assignedTo ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: INCLUDE_TICKET,
    })

    if (dto.assignedTo && dto.assignedTo !== user.sub) {
      this.eventBus.publish(new TicketAssignedEvent(ticket.id, dto.title, unitId, dto.assignedTo))
    }

    return ticket
  }

  async update(unitId: string, ticketId: string, dto: UpdateTicketDto, user: JwtPayload) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, unitId } })
    if (!ticket) throw new NotFoundException('Chamado não encontrado.')

    const wasAssigned = dto.assignedTo && dto.assignedTo !== ticket.assignedTo

    const resolvedAt =
      dto.status === TicketStatus.RESOLVED && ticket.status !== TicketStatus.RESOLVED
        ? new Date()
        : ticket.resolvedAt
    const closedAt =
      dto.status === TicketStatus.CLOSED && ticket.status !== TicketStatus.CLOSED
        ? new Date()
        : ticket.closedAt

    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assignedTo: dto.assignedTo,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        category: dto.category,
        resolvedAt,
        closedAt,
      },
      include: INCLUDE_TICKET,
    })

    if (wasAssigned && dto.assignedTo !== user.sub) {
      this.eventBus.publish(new TicketAssignedEvent(ticketId, updated.title, unitId, dto.assignedTo!))
    }

    if (dto.status && dto.status !== ticket.status && ticket.reportedBy !== user.sub) {
      this.eventBus.publish(
        new TicketStatusChangedEvent(ticketId, updated.title, unitId, ticket.reportedBy, dto.status),
      )
    }

    return updated
  }

  async addComment(unitId: string, ticketId: string, content: string, isInternal: boolean, user: JwtPayload) {
    const ticket = await this.prisma.ticket.findFirst({ where: { id: ticketId, unitId } })
    if (!ticket) throw new NotFoundException('Chamado não encontrado.')

    return this.prisma.ticketComment.create({
      data: { ticketId, userId: user.sub, content, isInternal },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })
  }

  async deleteComment(unitId: string, commentId: string, user: JwtPayload) {
    const comment = await this.prisma.ticketComment.findUnique({
      where: { id: commentId },
      include: { ticket: { select: { unitId: true } } },
    })
    if (!comment || comment.ticket.unitId !== unitId) {
      throw new NotFoundException('Comentário não encontrado.')
    }
    if (comment.userId !== user.sub) throw new NotFoundException('Sem permissão.')

    return this.prisma.ticketComment.delete({ where: { id: commentId } })
  }

  async getStats(unitId: string) {
    const [open, inProgress, resolved, critical] = await Promise.all([
      this.prisma.ticket.count({ where: { unitId, status: TicketStatus.OPEN } }),
      this.prisma.ticket.count({ where: { unitId, status: TicketStatus.IN_PROGRESS } }),
      this.prisma.ticket.count({ where: { unitId, status: TicketStatus.RESOLVED } }),
      this.prisma.ticket.count({ where: { unitId, priority: 'CRITICAL', status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } } }),
    ])
    return { open, inProgress, resolved, critical }
  }
}
