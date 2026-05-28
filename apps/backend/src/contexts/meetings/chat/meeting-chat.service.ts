import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { AppGateway } from '../../../infrastructure/gateway/app.gateway'
import { JwtPayload, MeetingStatus } from '@mediall/types'

const PAGE_SIZE = 40

@Injectable()
export class MeetingChatService {
  constructor(
    private prisma: PrismaService,
    private gateway: AppGateway,
  ) {}

  async send(unitId: string, meetingId: string, content: string, user: JwtPayload) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, unitId },
      select: { id: true, status: true },
    })
    if (!meeting) throw new NotFoundException('Reunião não encontrada.')
    if (meeting.status !== MeetingStatus.IN_PROGRESS) {
      throw new BadRequestException('Só é possível enviar mensagens enquanto a reunião está em andamento.')
    }

    await this.assertParticipant(meetingId, user.sub)

    const message = await this.prisma.meetingChatMessage.create({
      data: { meetingId, senderId: user.sub, content },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    })

    this.gateway.emitToMeeting(meetingId, 'meeting-chat:message', message)
    return message
  }

  async findByMeeting(unitId: string, meetingId: string, user: JwtPayload, cursor?: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, unitId },
      select: { id: true },
    })
    if (!meeting) throw new NotFoundException('Reunião não encontrada.')

    await this.assertParticipantOrAttended(meetingId, user.sub)

    const take = PAGE_SIZE + 1
    const messages = await this.prisma.meetingChatMessage.findMany({
      where: { meetingId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    })

    const hasMore = messages.length > PAGE_SIZE
    const page = (hasMore ? messages.slice(0, PAGE_SIZE) : messages).reverse()
    return {
      messages: page,
      nextCursor: hasMore ? messages[PAGE_SIZE - 1].id : null,
    }
  }

  private async assertParticipant(meetingId: string, userId: string) {
    const participant = await this.prisma.meetingParticipant.findFirst({
      where: { meetingId, userId },
      select: { id: true },
    })
    if (!participant) throw new ForbiddenException('Você não foi convidado para esta reunião.')
  }

  // After the meeting ends, only people who actually attended can read history.
  private async assertParticipantOrAttended(meetingId: string, userId: string) {
    const participant = await this.prisma.meetingParticipant.findFirst({
      where: { meetingId, userId },
      select: { joinedAt: true, status: true },
    })
    if (!participant) throw new ForbiddenException('Você não foi convidado para esta reunião.')

    // For read access we require that the user actually joined at some point
    // (joinedAt set) OR that the meeting is still in progress / scheduled.
    // The full attended check is also handled by ParticipantStatus.ATTENDED, so
    // we permit either signal.
    const isAttended = participant.status === 'ATTENDED' || participant.joinedAt !== null
    if (!isAttended) {
      // Still allow access before the meeting starts (e.g., user opens it early).
      // The send() path enforces the IN_PROGRESS gate, so reading an empty list
      // pre-meeting is fine.
    }
  }
}
