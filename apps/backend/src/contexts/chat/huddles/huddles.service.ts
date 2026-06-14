import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { Huddle } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { LiveKitService } from '../../../infrastructure/livekit/livekit.service'
import { AppGateway } from '../../../infrastructure/gateway/app.gateway'
import { JwtPayload } from '@mediall/types'

const HUDDLE_TTL = '1h'

// A call with <= 1 participant (nobody to talk to) for this long is auto-ended.
const LONELY_TIMEOUT_MS = 4 * 60 * 1000 // 4 minutes
// Don't reap a brand-new call while the starter is still establishing the
// WebRTC connection (LiveKit reports 0 participants until they connect).
const STARTUP_GRACE_MS = 90 * 1000 // 90 seconds

type ReconcilableHuddle = Pick<
  Huddle,
  'id' | 'groupId' | 'livekitRoomId' | 'startedAt' | 'participantCount' | 'lonelySince'
>

@Injectable()
export class HuddlesService {
  private readonly logger = new Logger(HuddlesService.name)

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
        // Optimistic: the starter is the only participant. The reconcile job
        // corrects this against LiveKit, and the lonely timer starts ticking
        // now so a call nobody joins is closed after LONELY_TIMEOUT_MS.
        participantCount: 1,
        lonelySince: new Date(),
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
    if (!huddle) throw new NotFoundException('Chamada não encontrada ou já encerrada.')

    await this.assertMembership(huddle.groupId, user.sub)

    return this.issueToken(huddle, user)
  }

  /**
   * The user asked to leave. Their LiveKit disconnect is the real signal, so
   * we just reconcile this call against LiveKit — closing it fast if the room
   * is now empty instead of waiting for the next reaper tick.
   */
  async leave(huddleId: string) {
    const huddle = await this.prisma.huddle.findUnique({ where: { id: huddleId } })
    if (huddle && !huddle.endedAt) {
      // Best-effort fast path; the reaper reconciles regardless, so a transient
      // LiveKit error here must not fail the request.
      await this.reconcile(huddle).catch((err) =>
        this.logger.warn(`leave reconcile failed for ${huddleId}: ${(err as Error).message}`),
      )
    }
    return { ok: true }
  }

  /** List the currently active huddle for a group (0 or 1). */
  async findActiveForGroup(unitId: string, groupId: string) {
    const huddle = await this.prisma.huddle.findFirst({
      where: { unitId, groupId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    })
    if (!huddle) return null

    // Explicit shape: matches the @mediall/types Huddle contract and keeps the
    // internal idle timer (lonelySince) out of the API response.
    return {
      id: huddle.id,
      groupId: huddle.groupId,
      unitId: huddle.unitId,
      startedBy: huddle.startedBy,
      startedAt: huddle.startedAt,
      endedAt: huddle.endedAt,
      livekitRoomId: huddle.livekitRoomId,
      participantCount: huddle.participantCount,
    }
  }

  /**
   * Reaper entry point (called by the cron job): reconcile every open call
   * against LiveKit, ending the ones that are empty or idle.
   */
  async reapStale() {
    const open = await this.prisma.huddle.findMany({ where: { endedAt: null } })
    const results = await Promise.allSettled(open.map((h) => this.reconcile(h)))
    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed > 0) this.logger.warn(`reapStale: ${failed}/${open.length} reconciliations failed`)
  }

  /**
   * Reconcile one call against LiveKit (the source of truth for presence):
   * update the persisted participant count, run the idle timer, and end the
   * call when it is empty (after a startup grace) or has had <= 1 participant
   * for longer than LONELY_TIMEOUT_MS.
   */
  private async reconcile(huddle: ReconcilableHuddle) {
    const real = await this.liveKit.countParticipants(huddle.livekitRoomId)
    const now = Date.now()
    const pastGrace = now - huddle.startedAt.getTime() > STARTUP_GRACE_MS

    // Idle timer: lonelySince marks when the call dropped to <= 1 participant.
    let lonelySince: Date | null = huddle.lonelySince
    if (real >= 2) lonelySince = null
    else if (!lonelySince) lonelySince = new Date(now)

    const idleTooLong = !!lonelySince && now - lonelySince.getTime() >= LONELY_TIMEOUT_MS
    if (pastGrace && (real === 0 || idleTooLong)) {
      await this.end(huddle)
      return
    }

    const countChanged = real !== huddle.participantCount
    const lonelyChanged =
      (lonelySince?.getTime() ?? null) !== (huddle.lonelySince?.getTime() ?? null)
    if (countChanged || lonelyChanged) {
      await this.prisma.huddle.updateMany({
        where: { id: huddle.id, endedAt: null },
        data: { participantCount: real, lonelySince },
      })
    }
    if (countChanged) {
      this.gateway.emitToGroup(huddle.groupId, 'huddle:participants', {
        huddleId: huddle.id,
        count: real,
      })
    }
  }

  private async end(huddle: Pick<Huddle, 'id' | 'groupId' | 'livekitRoomId'>) {
    // Idempotent: only the call that actually flips endedAt closes the room
    // and notifies, so concurrent reaper ticks don't double-emit.
    const res = await this.prisma.huddle.updateMany({
      where: { id: huddle.id, endedAt: null },
      data: { endedAt: new Date() },
    })
    if (res.count === 0) return

    await this.liveKit.deleteRoom(huddle.livekitRoomId)
    this.gateway.emitToGroup(huddle.groupId, 'huddle:ended', { huddleId: huddle.id })
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
        canPublish: true, // audio (+ screen if user opts in client-side)
        canSubscribe: true,
        canPublishData: true,
      },
    })

    return {
      huddleId: huddle.id,
      groupId: huddle.groupId,
      roomId: huddle.livekitRoomId,
      token,
      wsUrl: this.liveKit.wsUrl,
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
