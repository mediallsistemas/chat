import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'
import { MessagesService } from './messages.service'
import { SendMessageDto, EditMessageDto } from './dto/send-message.dto'

class ReactionDto {
  @IsString()
  @Length(1, 10)
  emoji: string
}
import { BaseUnitController } from '../../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@ApiTags('messages')
@Controller('units/:unitId')
export class MessagesController extends BaseUnitController {
  constructor(private messagesService: MessagesService) {
    super()
  }

  @Get('groups/:groupId/messages')
  findByGroup(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagesService.findByGroup(unitId, groupId, cursor)
  }

  @Get('groups/:groupId/messages/pinned')
  findPinned(@Param('unitId') unitId: string, @Param('groupId') groupId: string) {
    return this.messagesService.findPinned(unitId, groupId)
  }

  @Get('groups/:groupId/messages/:messageId/thread')
  findThread(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.findThread(unitId, groupId, messageId, user)
  }

  @Post('groups/:groupId/messages')
  send(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.send(unitId, groupId, dto, user)
  }

  @Patch('groups/:groupId/messages/:messageId')
  edit(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.edit(unitId, groupId, messageId, dto, user)
  }

  @Delete('groups/:groupId/messages/:messageId')
  delete(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.delete(unitId, groupId, messageId, user)
  }

  @Patch('groups/:groupId/messages/:messageId/pin')
  togglePin(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messagesService.togglePin(unitId, groupId, messageId)
  }

  @Post('groups/:groupId/messages/:messageId/reactions')
  toggleReaction(
    @Param('unitId') unitId: string,
    @Param('groupId') groupId: string,
    @Param('messageId') messageId: string,
    @Body() dto: ReactionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messagesService.toggleReaction(unitId, groupId, messageId, dto.emoji, user)
  }
}
