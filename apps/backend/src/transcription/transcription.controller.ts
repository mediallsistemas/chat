import { Controller, Post, Get, Param, Body } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger'
import { TranscriptionService } from './transcription.service'
import { ProcessTranscriptDto } from './dto/process-transcript.dto'
import { BaseUnitController } from '../shared/controllers/base-unit.controller'
import { CurrentUser } from '../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@ApiTags('meetings')
@ApiCookieAuth('access_token')
@Controller('units/:unitId')
export class TranscriptionController extends BaseUnitController {
  constructor(private transcriptionService: TranscriptionService) {
    super()
  }

  @Post('meetings/:meetingId/transcript')
  @ApiOperation({ summary: 'Process meeting transcript with Claude AI' })
  process(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: ProcessTranscriptDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transcriptionService.processTranscript(unitId, meetingId, dto.transcript, user.sub)
  }

  @Get('meetings/:meetingId/transcript')
  @ApiOperation({ summary: 'Get meeting transcript and AI analysis' })
  getTranscript(
    @Param('unitId') unitId: string,
    @Param('meetingId') meetingId: string,
  ) {
    return this.transcriptionService.getTranscript(unitId, meetingId)
  }
}
