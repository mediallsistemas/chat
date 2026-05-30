import { Controller, Get, Headers, Param, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import { Public } from '../../shared/decorators/public.decorator'

/**
 * Internal HTTP API for service-to-service calls. Authenticated via static
 * shared token (MONOLITH_INTERNAL_TOKEN env var). Routes here are NOT public
 * to end users — they live on the internal Docker network only and should
 * not be exposed by Nginx. Marked @Public so the JWT guard bypasses them
 * (the x-internal-token header acts as the auth).
 */
@Public()
@Controller('internal/v1/meetings')
export class InternalMeetingsController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Get(':id')
  async getMeeting(@Param('id') id: string, @Headers('x-internal-token') token?: string) {
    const expected = this.config.get<string>('MONOLITH_INTERNAL_TOKEN')
    if (!expected || token !== expected) {
      throw new UnauthorizedException('Invalid internal token')
    }

    const meeting = await this.prisma.meeting.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        unitId: true,
        startAt: true,
        endAt: true,
        createdBy: true,
        participants: { select: { userId: true } },
      },
    })
    if (!meeting) throw new NotFoundException('Meeting not found')

    return {
      id: meeting.id,
      title: meeting.title,
      unitId: meeting.unitId,
      startAt: meeting.startAt.toISOString(),
      endAt: meeting.endAt.toISOString(),
      participantUserIds: meeting.participants.map((p) => p.userId),
      createdBy: meeting.createdBy,
    }
  }
}
