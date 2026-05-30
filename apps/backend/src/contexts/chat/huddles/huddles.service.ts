import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { PrismaService } from '../../../prisma/prisma.service'
import { LiveKitService } from '../../../infrastructure/livekit/livekit.service'
import { AppGateway } from '../../../infrastructure/gateway/app.gateway'
import { JwtPayload } from '@mediall/types'

const HUDDLE_TTL = '1h'

@Injectable()
export class HuddlesService {
  // huddleId → Set<userId> of currently connected participants.
  // In-memory is enough: huddles are ephemeral by design and a process
  // restart should fail open (mark the huddle as ended).
  private active = new Map<string, Set<string>>()

  constructor(
    private prisma: PrismaService,
    private liveKit: LiveKitService,
    private gateway: AppGateway,
  ) {}

  /**
   * Start a huddle in the group OR return the active one. Idempotent so
   * a "race" between two users clicking "Start huddle" lands them in the
   * same room.
   */
  async start(unitId: string, groupId: string, user: JwtPayload) {
    await this.assertMembership(groupId, user.sub)

    const existing = await this.prisma.huddle.findFirst({
      where: { groupId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    })

    if (existing) {
      return this.issueToken(existing, user)
    }

    const huddle = await this.prisma.huddle.create({
      data: {
        groupId,
        unitId,
        startedBy: user.sub,
        livekitRoomId: `huddle-${randomUUID()}`,
      },
    })

    this.gateway.emitToGroup(groupId, 'huddle:started', {
      huddleId: huddle.id,
      groupId,
      startedBy: user.sub,
      startedAt: huddle.startedAt.toISOString(),
    })

    return this.issueToken(huddle, user)
  }

  async join(unitId: string, huddleId: string, user: JwtPayload) {
    const huddle = await this.prisma.huddle.findFirst({
      where: { id: huddleId, unitId, endedAt: null },
    })
    if (!huddle) throw new NotFoundException('Huddle não encontrado ou já encerrado.')

    await this.assertMembership(huddle.groupId, user.sub)

    return this.issueToken(huddle, user)
  }

  async leave(huddleId: string, user: JwtPayload) {
    const huddle = await this.prisma.huddle.findUnique({ where: { id: huddleId } })
    if (!huddle || huddle.endedAt) return { ok: true }

    const set = this.active.get(huddleId)
    if (set) {
      set.delete(user.sub)
      if (set.size === 0) {
        this.active.delete(huddleId)
        await this.end(huddle.id, huddle.groupId)
      } else {
        this.gateway.emitToGroup(huddle.groupId, 'huddle:participants', {
          huddleId,
          count: set.size,
        })
      }
    }
    return { ok: true }
  }

  /** List the currently active huddles for a group (0 or 1). */
  async findActiveForGroup(unitId: string, groupId: string) {
    const huddle = await this.prisma.huddle.findFirst({
      where: { unitId, groupId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    })
    if (!huddle) return null

    return {
      ...huddle,
      participantCount: this.active.get(huddle.id)?.size ?? 0,
    }
  }

  private async end(huddleId: string, groupId: string) {
    await this.prisma.huddle.update({
      where: { id: huddleId },
      data: { endedAt: new Date() },
    })
    this.gateway.emitToGroup(groupId, 'huddle:ended', { huddleId })
  }

  private async issueToken(
    huddle: { id: string; livekitRoomId: string; groupId: string },
    user: JwtPayload,
  ) {
    const token = await this.liveKit.createToken({
      identity: user.sub,
      name: user.name,
      ttl: HUDDLE_TTL,
      grants: {
        roomJoin: true,
        room: huddle.livekitRoomId,
        canPublish: true,        // audio (+ screen if user opts in client-side)
        canSubscribe: true,
        canPublishData: true,
      },
    })

    // Track participant in memory; broadcast new participant count
    let set = this.active.get(huddle.id)
    if (!set) {
      set = new Set()
      this.active.set(huddle.id, set)
    }
    set.add(user.sub)

    this.gateway.emitToGroup(huddle.groupId, 'huddle:participants', {
      huddleId: huddle.id,
      count: set.size,
    })

    return {
      huddleId: huddle.id,
      groupId: huddle.groupId,
      roomId: huddle.livekitRoomId,
      token,
      wsUrl: this.liveKit.wsUrl,
      participantCount: set.size,
    }
  }

  private async assertMembership(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId },
      select: { id: true },
    })
    if (!member) throw new ForbiddenException('Você não é membro deste grupo.')
  }
}
