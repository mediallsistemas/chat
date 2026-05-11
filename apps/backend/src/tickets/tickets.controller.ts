import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger'
import { IsOptional, IsString, IsBoolean } from 'class-validator'
import { Transform } from 'class-transformer'
import { TicketsService } from './tickets.service'
import { CreateTicketDto } from './dto/create-ticket.dto'
import { UpdateTicketDto } from './dto/update-ticket.dto'
import { PaginationDto } from '../common/dto/pagination.dto'
import { BaseUnitController } from '../shared/controllers/base-unit.controller'
import { CurrentUser } from '../shared/decorators/current-user.decorator'
import { JwtPayload, TicketStatus } from '@mediall/types'

class CommentDto {
  @IsString()
  content: string

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isInternal?: boolean
}

class TicketsQuery {
  @IsOptional()
  @IsString()
  status?: TicketStatus
}

@ApiTags('tickets')
@ApiCookieAuth('access_token')
@Controller('units/:unitId')
export class TicketsController extends BaseUnitController {
  constructor(private ticketsService: TicketsService) {
    super()
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List tickets in the unit' })
  findAll(@Param('unitId') unitId: string, @Query() query: TicketsQuery & PaginationDto) {
    return this.ticketsService.findAll(unitId, query.status, { limit: query.limit, offset: query.offset })
  }

  @Get('tickets/stats')
  @ApiOperation({ summary: 'Get ticket statistics' })
  getStats(@Param('unitId') unitId: string) {
    return this.ticketsService.getStats(unitId)
  }

  @Get('tickets/:ticketId')
  @ApiOperation({ summary: 'Get ticket detail with comments' })
  findOne(@Param('unitId') unitId: string, @Param('ticketId') ticketId: string) {
    return this.ticketsService.findOne(unitId, ticketId)
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Create a new ticket' })
  create(
    @Param('unitId') unitId: string,
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.create(unitId, dto, user)
  }

  @Patch('tickets/:ticketId')
  @ApiOperation({ summary: 'Update ticket (status, priority, assignment, etc.)' })
  update(
    @Param('unitId') unitId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.update(unitId, ticketId, dto, user)
  }

  @Post('tickets/:ticketId/comments')
  @ApiOperation({ summary: 'Add comment to ticket' })
  addComment(
    @Param('unitId') unitId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: CommentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.addComment(unitId, ticketId, dto.content, dto.isInternal ?? false, user)
  }

  @Delete('tickets/comments/:commentId')
  @ApiOperation({ summary: 'Delete a comment' })
  deleteComment(
    @Param('unitId') unitId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ticketsService.deleteComment(unitId, commentId, user)
  }
}
