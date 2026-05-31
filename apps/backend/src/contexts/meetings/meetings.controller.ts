import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  UseGuards,
} from '@nestjs/common'
import { MeetingsService } from './meetings.service'
import { CreateMeetingDto } from './dto/create-meeting.dto'
import { UpdateMeetingDto } from './dto/update-meeting.dto'
import { RespondInviteDto } from './dto/respond-invite.dto'
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard'
import { RolesGuard } from '../../shared/guards/roles.guard'
import { UnitScopeGuard } from '../../shared/guards/unit-scope.guard'
import { Roles } from '../../shared/decorators/roles.decorator'
import { UserRole } from '@mediall/types'

@Controller('units/:unitId/meetings')
@UseGuards(JwtAuthGuard, RolesGuard, UnitScopeGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  @Get()
  findAll(@Param('unitId') unitId: string) {
    return this.meetingsService.findAll(unitId)
  }

  // ─── Agenda (must be before :meetingId to avoid param capture) ────────────

  @Get('agenda')
  getAgenda(
    @Param('unitId') unitId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const fromDate = from ? new Date(from) : new Date()
    const toDate = to
      ? new Date(to)
      : new Date(fromDate.getFullYear(), fromDate.getMonth() + 2, 1)
    return this.meetingsService.getAgenda(unitId, fromDate, toDate)
  }

  @Get(':meetingId')
  findOne(@Param('unitId') unitId: string, @Param('meetingId') meetingId: string) {
    return this.meetingsService.findOne(unitId, meetingId)
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  create(@Param('unitId') unitId: string, @Req() req: any, @Body() dto: CreateMeetingDto) {
    return this.meetingsService.create(unitId, req.user.sub, dto)
  }

  @Patch(':meetingId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  update(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Req() req: any,
    @Body() dto: UpdateMeetingDto,
  ) {
    return this.meetingsService.update(unitId, meetingId, req.user.sub, dto)
  }

  @Post(':meetingId/cancel')
  @HttpCode(200)
  cancel(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Req() req: any,
  ) {
    return this.meetingsService.cancel(unitId, meetingId, req.user.sub)
  }

  @Post(':meetingId/respond')
  @HttpCode(200)
  respond(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Req() req: any,
    @Body() dto: RespondInviteDto,
  ) {
    return this.meetingsService.respondInvite(unitId, meetingId, req.user.sub, dto.status)
  }

  @Get(':meetingId/token')
  getToken(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Req() req: any,
  ) {
    return this.meetingsService.generateToken(unitId, meetingId, req.user.sub)
  }

  @Post(':meetingId/start')
  @HttpCode(200)
  start(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Req() req: any,
  ) {
    return this.meetingsService.startRoom(unitId, meetingId, req.user.sub)
  }

  @Post(':meetingId/end')
  @HttpCode(200)
  end(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Req() req: any,
  ) {
    return this.meetingsService.endRoom(unitId, meetingId, req.user.sub)
  }

  // ─── Recording ────────────────────────────────────────────────────────────

  @Post(':meetingId/recording/request-consent')
  @HttpCode(200)
  requestConsent(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Req() req: any,
  ) {
    return this.meetingsService.requestRecordingConsent(unitId, meetingId, req.user.sub)
  }

  @Post(':meetingId/recording/consent')
  @HttpCode(200)
  submitConsent(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Body() body: { consent?: boolean },
    @Req() req: any,
  ) {
    return this.meetingsService.submitRecordingConsent(
      unitId,
      meetingId,
      req.user.sub,
      body?.consent ?? true,
    )
  }

  @Post(':meetingId/recording/start')
  @HttpCode(200)
  startRecording(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Req() req: any,
  ) {
    return this.meetingsService.startRecording(unitId, meetingId, req.user.sub)
  }

  @Post(':meetingId/recording/stop')
  @HttpCode(200)
  stopRecording(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Req() req: any,
  ) {
    return this.meetingsService.stopRecording(unitId, meetingId, req.user.sub)
  }
}
