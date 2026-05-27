import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SearchService } from './search.service'
import { SearchMessagesDto } from './dto/search.dto'
import { BaseUnitController } from '../../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

@ApiTags('chat-search')
@Controller('units/:unitId')
export class SearchController extends BaseUnitController {
  constructor(private searchService: SearchService) {
    super()
  }

  @Get('chat/search')
  search(
    @Param('unitId') unitId: string,
    @Query() dto: SearchMessagesDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.searchService.search(unitId, user, dto)
  }
}
