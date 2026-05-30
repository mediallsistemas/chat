import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { BookmarksService } from './bookmarks.service'
import { CreateBookmarkDto } from './dto/bookmark.dto'
import { BaseUnitController } from '../../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@ApiTags('chat-bookmarks')
@Controller('units/:unitId')
export class BookmarksController extends BaseUnitController {
  constructor(private bookmarksService: BookmarksService) {
    super()
  }

  @Get('chat/bookmarks')
  findAll(
    @Param('unitId') unitId: string,
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
  ) {
    return this.bookmarksService.findAll(unitId, user, cursor)
  }

  @Post('chat/bookmarks')
  create(
    @Param('unitId') unitId: string,
    @Body() dto: CreateBookmarkDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bookmarksService.create(unitId, dto.messageId, user)
  }

  @Delete('chat/bookmarks/:messageId')
  delete(
    @Param('unitId') unitId: string,
    @Param('messageId') messageId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bookmarksService.delete(unitId, messageId, user)
  }
}
