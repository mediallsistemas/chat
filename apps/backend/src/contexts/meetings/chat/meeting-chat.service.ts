import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { AppGateway } from '../../../infrastructure/gateway/app.gateway'
import { JwtPayload, MeetingStatus, ParticipantStatus } from '@mediall/types'

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
      select: { id: true, status: true },
    })
    if (!meeting) throw new NotFoundException('Reunião não encontrada.')

    await this.assertCanReadHistory(meetingId, user.sub, meeting.status)

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

  // Read access rules:
  //  - Must be a MeetingParticipant (invitees of this meeting only).
  //  - Once the meeting is over (DONE/CANCELLED), only people who actually
  //    attended may read the history — a mere invitee who never joined cannot.
  //  - While SCHEDULED/IN_PROGRESS, any invitee may open it (the send() path
  //    still gates posting to IN_PROGRESS).
  private async assertCanReadHistory(
    meetingId: string,
    userId: string,
    status: string,
  ) {
    const participant = await this.prisma.meetingParticipant.findFirst({
      where: { meetingId, userId },
      select: { joinedAt: true, status: true },
    })
    if (!participant) throw new ForbiddenException('Você não foi convidado para esta reunião.')

    const meetingOver = status === MeetingStatus.DONE || status === MeetingStatus.CANCELLED
    if (!meetingOver) return

    const attended =
      participant.status === ParticipantStatus.ATTENDED || participant.joinedAt !== null
    if (!attended) {
      throw new ForbiddenException(
        'Apenas quem participou da reunião pode ver o histórico do chat.',
      )
    }
  }
}
