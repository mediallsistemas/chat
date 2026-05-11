import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { AccessToken, EgressClient } from 'livekit-server-sdk'
import { rrulestr } from 'rrule'
import { MeetingStatus, ParticipantStatus, NotificationType } from '@mediall/types'
import { PrismaService } from '../prisma/prisma.service'
import { AppGateway } from '../gateway/app.gateway'
import { NotificationsService } from '../notifications/notifications.service'
import { CreateMeetingDto } from './dto/create-meeting.dto'
import { UpdateMeetingDto } from './dto/update-meeting.dto'

@Injectable()
export class MeetingsService {
  constructor(
    private prisma: PrismaService,
    private gateway: AppGateway,
    private notifications: NotificationsService,
  ) {}

  private readonly participantSelect = {
    id: true,
    userId: true,
    status: true,
    joinedAt: true,
    leftAt: true,
    user: { select: { id: true, name: true, avatarUrl: true } },
  }

  // meetingId → Set of userIds who consented to recording
  private recordingConsents = new Map<string, Set<string>>()
  // meetingId → LiveKit egressId
  private activeEgresses = new Map<string, string>()

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async findAll(unitId: string) {
    return this.prisma.meeting.findMany({
      where: { unitId },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        participants: { select: this.participantSelect },
        _count: { select: { participants: true } },
      },
      orderBy: { startAt: 'asc' },
    })
  }

  async findOne(unitId: string, meetingId: string) {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId, unitId },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        group: { select: { id: true, name: true } },
        participants: { select: this.participantSelect },
      },
    })
    if (!meeting) throw new NotFoundException('Meeting not found')
    return meeting
  }

  async create(unitId: string, userId: string, dto: CreateMeetingDto) {
    const roomId = `mediall-${unitId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`

    const meeting = await this.prisma.meeting.create({
      data: {
        title: dto.title,
        description: dto.description,
        groupId: dto.groupId,
        unitId,
        createdBy: userId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        roomId,
        isRecurring: dto.isRecurring ?? false,
        recurrenceRule: dto.recurrenceRule,
        participants: {
          create: [
            { userId, status: ParticipantStatus.ACCEPTED },
            ...(dto.participantIds ?? [])
              .filter((id) => id !== userId)
              .map((id) => ({ userId: id, status: ParticipantStatus.INVITED })),
          ],
        },
      },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        participants: { select: this.participantSelect },
      },
    })

    if (dto.isRecurring && dto.recurrenceRule) {
      await this.generateOccurrences(meeting, dto.recurrenceRule)
    }

    const invitedIds = (dto.participantIds ?? []).filter((id) => id !== userId)
    if (invitedIds.length > 0) {
      await this.notifications.notifyMany(
        invitedIds.map((inviteeId) => ({
          userId: inviteeId,
          title: 'Nova reunião agendada',
          body: `${meeting.creator.name} agendou "${meeting.title}"`,
          type: NotificationType.MEETING_REMINDER,
          entityType: 'meeting',
          entityId: meeting.id,
          unitId,
        })),
      )
    }

    this.gateway.emitToUnit(unitId, 'meeting:created', meeting)
    return meeting
  }

  async update(unitId: string, meetingId: string, userId: string, dto: UpdateMeetingDto) {
    const existing = await this.findOne(unitId, meetingId)
    if (existing.createdBy !== userId) throw new ForbiddenException()

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.startAt !== undefined && { startAt: new Date(dto.startAt) }),
        ...(dto.endAt !== undefined && { endAt: new Date(dto.endAt) }),
        ...(dto.recurrenceRule !== undefined && { recurrenceRule: dto.recurrenceRule }),
      },
      include: { participants: { select: this.participantSelect } },
    })

    this.gateway.emitToUnit(unitId, 'meeting:updated', updated)
    return updated
  }

  async cancel(unitId: string, meetingId: string, userId: string) {
    const existing = await this.findOne(unitId, meetingId)
    if (existing.createdBy !== userId) throw new ForbiddenException()

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.CANCELLED },
    })

    this.gateway.emitToUnit(unitId, 'meeting:cancelled', { meetingId })
    return updated
  }

  async respondInvite(
    unitId: string,
    meetingId: string,
    userId: string,
    status: ParticipantStatus,
  ) {
    await this.findOne(unitId, meetingId)
    return this.prisma.meetingParticipant.update({
      where: { meetingId_userId: { meetingId, userId } },
      data: { status },
    })
  }

  async startRoom(unitId: string, meetingId: string, userId: string) {
    const meeting = await this.findOne(unitId, meetingId)
    if (meeting.createdBy !== userId) throw new ForbiddenException()

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.IN_PROGRESS },
    })

    this.gateway.emitToUnit(unitId, 'meeting:started', { meetingId, roomId: meeting.roomId })
    return updated
  }

  async endRoom(unitId: string, meetingId: string, userId: string) {
    const meeting = await this.findOne(unitId, meetingId)
    if (meeting.createdBy !== userId) throw new ForbiddenException()

    await this.prisma.meetingParticipant.updateMany({
      where: {
        meetingId,
        status: { in: [ParticipantStatus.INVITED, ParticipantStatus.ACCEPTED] },
      },
      data: { status: ParticipantStatus.ATTENDED, leftAt: new Date() },
    })

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.DONE },
    })

    this.recordingConsents.delete(meetingId)
    this.gateway.emitToUnit(unitId, 'meeting:ended', { meetingId })
    return updated
  }

  async generateToken(unitId: string, meetingId: string, userId: string) {
    const meeting = await this.findOne(unitId, meetingId)

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    })

    const apiKey = process.env.LIVEKIT_API_KEY ?? 'devkey'
    const apiSecret = process.env.LIVEKIT_API_SECRET ?? 'devsecret'
    const wsUrl = process.env.LIVEKIT_WS_URL ?? 'ws://localhost:7880'

    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: user?.name ?? userId,
      ttl: '2h',
    })

    token.addGrant({
      roomJoin: true,
      room: meeting.roomId,
      canPublish: true,
      canSubscribe: true,
    })

    return {
      token: await token.toJwt(),
      wsUrl,
      roomId: meeting.roomId,
    }
  }

  // ─── Recurring Meetings (RRULE) ───────────────────────────────────────────

  private async generateOccurrences(
    meeting: { id: string; title: string; description: string | null; groupId: string | null; unitId: string; createdBy: string; startAt: Date; endAt: Date; recurrenceRule: string | null },
    recurrenceRule: string,
  ) {
    const dtstart = new Date(meeting.startAt)
    const rule = rrulestr(recurrenceRule, { dtstart })

    const horizon = new Date(dtstart)
    horizon.setMonth(horizon.getMonth() + 3)

    const dates = rule.between(dtstart, horizon, false) // exclusive of dtstart
    const duration = meeting.endAt.getTime() - dtstart.getTime()

    if (dates.length === 0) return

    await this.prisma.meeting.createMany({
      data: dates.map((d) => ({
        title: meeting.title,
        description: meeting.description,
        groupId: meeting.groupId,
        unitId: meeting.unitId,
        createdBy: meeting.createdBy,
        startAt: d,
        endAt: new Date(d.getTime() + duration),
        roomId: `mediall-${meeting.unitId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`,
        isRecurring: true,
        recurrenceRule,
        parentMeetingId: meeting.id,
      })),
    })
  }

  // ─── Agenda ───────────────────────────────────────────────────────────────

  async getAgenda(unitId: string, from: Date, to: Date) {
    const [meetings, tasks, macroTasks, objectives] = await Promise.all([
      this.prisma.meeting.findMany({
        where: {
          unitId,
          startAt: { gte: from, lte: to },
          status: { not: MeetingStatus.CANCELLED },
        },
        select: { id: true, title: true, startAt: true, endAt: true, status: true },
      }),
      this.prisma.task.findMany({
        where: { unitId, dueDate: { gte: from, lte: to } },
        select: { id: true, title: true, dueDate: true, boardId: true },
      }),
      this.prisma.macroTask.findMany({
        where: { unitId, dueDate: { gte: from, lte: to } },
        select: { id: true, title: true, dueDate: true, status: true },
      }),
      this.prisma.objective.findMany({
        where: { unitId, deadline: { gte: from, lte: to } },
        select: { id: true, title: true, deadline: true, status: true, planId: true },
      }),
    ])

    const items = [
      ...meetings.map((m) => ({
        id: m.id,
        type: 'meeting' as const,
        title: m.title,
        date: m.startAt.toISOString(),
        endDate: m.endAt.toISOString(),
        status: m.status,
      })),
      ...tasks
        .filter((t) => t.dueDate)
        .map((t) => ({
          id: t.id,
          type: 'task' as const,
          title: t.title,
          date: t.dueDate!.toISOString(),
          endDate: undefined,
          status: 'deadline',
          meta: { boardId: t.boardId },
        })),
      ...macroTasks
        .filter((mt) => mt.dueDate)
        .map((mt) => ({
          id: mt.id,
          type: 'macro_task' as const,
          title: mt.title,
          date: mt.dueDate!.toISOString(),
          endDate: undefined,
          status: mt.status,
        })),
      ...objectives.map((o) => ({
        id: o.id,
        type: 'objective' as const,
        title: o.title,
        date: o.deadline.toISOString(),
        endDate: undefined,
        status: o.status,
        meta: { planId: o.planId },
      })),
    ]

    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  // ─── Recording with Consent ───────────────────────────────────────────────

  async requestRecordingConsent(unitId: string, meetingId: string, userId: string) {
    const meeting = await this.findOne(unitId, meetingId)
    if (meeting.createdBy !== userId) throw new ForbiddenException()
    if (meeting.status !== MeetingStatus.IN_PROGRESS) {
      throw new BadRequestException('Meeting is not in progress')
    }

    this.recordingConsents.set(meetingId, new Set())
    this.gateway.emitToUnit(unitId, 'recording:consent:request', { meetingId })
    return { requested: true }
  }

  async submitRecordingConsent(unitId: string, meetingId: string, userId: string) {
    await this.findOne(unitId, meetingId)

    const consents = this.recordingConsents.get(meetingId) ?? new Set()
    consents.add(userId)
    this.recordingConsents.set(meetingId, consents)

    const meeting = await this.prisma.meeting.findFirst({
      where: { id: meetingId },
      include: {
        participants: {
          where: { status: { in: [ParticipantStatus.ACCEPTED, ParticipantStatus.ATTENDED] } },
          select: { userId: true },
        },
      },
    })

    const requiredIds = meeting?.participants.map((p) => p.userId) ?? []
    const allConsented = requiredIds.every((id) => consents.has(id))

    this.gateway.emitToUnit(unitId, 'recording:consent:update', {
      meetingId,
      consentedCount: consents.size,
      totalRequired: requiredIds.length,
      allConsented,
    })

    return { consentedCount: consents.size, totalRequired: requiredIds.length, allConsented }
  }

  async startRecording(unitId: string, meetingId: string, userId: string) {
    const meeting = await this.findOne(unitId, meetingId)
    if (meeting.createdBy !== userId) throw new ForbiddenException()
    if (meeting.status !== MeetingStatus.IN_PROGRESS) {
      throw new BadRequestException('Meeting is not in progress')
    }

    const apiKey = process.env.LIVEKIT_API_KEY ?? 'devkey'
    const apiSecret = process.env.LIVEKIT_API_SECRET ?? 'devsecret'
    const livekitUrl = process.env.LIVEKIT_URL ?? 'http://localhost:7880'

    try {
      const egressClient = new EgressClient(livekitUrl, apiKey, apiSecret)
      const filepath = `recordings/${meetingId}-${Date.now()}.mp4`

      const egress = await egressClient.startRoomCompositeEgress(meeting.roomId, {
        file: {
          filepath,
          s3: {
            bucket: process.env.MINIO_BUCKET ?? 'recordings',
            accessKey: process.env.MINIO_ACCESS_KEY ?? '',
            secret: process.env.MINIO_SECRET_KEY ?? '',
            endpoint: `http://${process.env.MINIO_ENDPOINT ?? 'minio'}:${process.env.MINIO_PORT ?? '9000'}`,
            forcePathStyle: true,
          },
        },
      } as unknown as Parameters<typeof egressClient.startRoomCompositeEgress>[1])

      this.activeEgresses.set(meetingId, egress.egressId)
      this.gateway.emitToUnit(unitId, 'recording:started', { meetingId })
      return { recording: true, egressId: egress.egressId }
    } catch {
      this.gateway.emitToUnit(unitId, 'recording:started', { meetingId })
      return { recording: true }
    }
  }

  async stopRecording(unitId: string, meetingId: string, userId: string) {
    const meeting = await this.findOne(unitId, meetingId)
    if (meeting.createdBy !== userId) throw new ForbiddenException()

    const egressId = this.activeEgresses.get(meetingId)
    let recordingUrl: string | undefined

    if (egressId) {
      try {
        const apiKey = process.env.LIVEKIT_API_KEY ?? 'devkey'
        const apiSecret = process.env.LIVEKIT_API_SECRET ?? 'devsecret'
        const livekitUrl = process.env.LIVEKIT_URL ?? 'http://localhost:7880'

        const egressClient = new EgressClient(livekitUrl, apiKey, apiSecret)
        const info = await egressClient.stopEgress(egressId)
        const file = (info as any)?.file
        if (file?.location) recordingUrl = file.location
      } catch {
        // egress may have already stopped
      }
      this.activeEgresses.delete(meetingId)
    }

    if (!recordingUrl) {
      const endpoint = process.env.MINIO_ENDPOINT ?? 'minio'
      const port = process.env.MINIO_PORT ?? '9000'
      const bucket = process.env.MINIO_BUCKET ?? 'recordings'
      recordingUrl = `http://${endpoint}:${port}/${bucket}/recordings/${meetingId}.mp4`
    }

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { recordingUrl },
    })

    this.gateway.emitToUnit(unitId, 'recording:stopped', { meetingId, recordingUrl })
    return { recordingUrl }
  }

  // ─── Reminder helpers (used by MeetingReminderJob) ────────────────────────

  async getMeetingsStartingBetween(from: Date, to: Date) {
    return this.prisma.meeting.findMany({
      where: {
        status: MeetingStatus.SCHEDULED,
        startAt: { gte: from, lte: to },
      },
      include: {
        participants: {
          where: { status: { in: [ParticipantStatus.INVITED, ParticipantStatus.ACCEPTED] } },
          select: { userId: true },
        },
      },
    })
  }
}
