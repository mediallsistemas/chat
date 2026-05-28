import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { MeetingChatService } from './meeting-chat.service'
import { SendMeetingChatDto } from './dto/send-meeting-chat.dto'
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard'
import { RolesGuard } from '../../../shared/guards/roles.guard'
import { UnitScopeGuard } from '../../../shared/guards/unit-scope.guard'

@ApiTags('meeting-chat')
@Controller('units/:unitId/meetings/:meetingId/chat')
@UseGuards(JwtAuthGuard, RolesGuard, UnitScopeGuard)
export class MeetingChatController {
  constructor(private readonly meetingChatService: MeetingChatService) {}

  @Get()
  findByMeeting(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Req() req: any,
    @Query('cursor') cursor?: string,
  ) {
    return this.meetingChatService.findByMeeting(unitId, meetingId, req.user, cursor)
  }

  @Post()
  send(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: SendMeetingChatDto,
    @Req() req: any,
  ) {
    return this.meetingChatService.send(unitId, meetingId, dto.content, req.user)
  }
}
