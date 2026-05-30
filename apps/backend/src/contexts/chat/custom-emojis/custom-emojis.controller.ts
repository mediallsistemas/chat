import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common'
import { ApiTags, ApiConsumes } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { CustomEmojisService } from './custom-emojis.service'
import { CreateCustomEmojiDto } from './dto/create-custom-emoji.dto'
import { BaseUnitController } from '../../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../../shared/decorators/current-user.decorator'
import { Roles } from '../../../shared/decorators/roles.decorator'
import { JwtPayload, UserRole } from '@mediall/types'

interface MulterFile {
  buffer: Buffer
  mimetype: string
  size: number
  originalname: string
}

const MAX_SIZE = 512 * 1024 // 512 KB upper bound; service enforces 256 KB

@ApiTags('chat-custom-emojis')
@Controller('units/:unitId')
export class CustomEmojisController extends BaseUnitController {
  constructor(private customEmojisService: CustomEmojisService) {
    super()
  }

  @Get('chat/custom-emojis')
  findAll(@Param('unitId') unitId: string) {
    return this.customEmojisService.findAll(unitId)
  }

  @Post('chat/custom-emojis')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  create(
    @Param('unitId') unitId: string,
    @Body() dto: CreateCustomEmojiDto,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.')
    return this.customEmojisService.create(unitId, dto.shortcode, file, user)
  }

  @Delete('chat/custom-emojis/:id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA, UserRole.GESTOR)
  delete(@Param('unitId') unitId: string, @Param('id') id: string) {
    return this.customEmojisService.delete(unitId, id)
  }
}
