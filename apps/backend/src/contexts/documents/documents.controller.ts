import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiConsumes, ApiOperation, ApiCookieAuth } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'
import { DocumentsService } from './documents.service'
import { CreateFolderDto } from './dto/create-folder.dto'
import { BaseUnitController } from '../../shared/controllers/base-unit.controller'
import { CurrentUser } from '../../shared/decorators/current-user.decorator'
import { JwtPayload } from '@mediall/types'

class ListDocsQuery {
  @IsOptional()
  @IsString()
  folderId?: string
}

const MAX_SIZE = 50 * 1024 * 1024 // 50 MB

@ApiTags('documents')
@ApiCookieAuth('access_token')
@Controller('units/:unitId')
export class DocumentsController extends BaseUnitController {
  constructor(private documentsService: DocumentsService) {
    super()
  }

  // ─── Folders ─────────────────────────────────────────────────────────────────

  @Get('document-folders')
  @ApiOperation({ summary: 'List all document folders in the unit' })
  listFolders(@Param('unitId') unitId: string) {
    return this.documentsService.listFolders(unitId)
  }

  @Post('document-folders')
  @ApiOperation({ summary: 'Create a document folder' })
  createFolder(
    @Param('unitId') unitId: string,
    @Body() dto: CreateFolderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentsService.createFolder(unitId, dto, user)
  }

  @Delete('document-folders/:folderId')
  @ApiOperation({ summary: 'Delete a document folder' })
  deleteFolder(@Param('unitId') unitId: string, @Param('folderId') folderId: string) {
    return this.documentsService.deleteFolder(unitId, folderId)
  }

  // ─── Documents ───────────────────────────────────────────────────────────────

  @Get('documents')
  @ApiOperation({ summary: 'List documents in folder (or root if no folderId)' })
  listDocuments(@Param('unitId') unitId: string, @Query() query: ListDocsQuery) {
    return this.documentsService.listDocuments(unitId, query.folderId)
  }

  @Post('documents/upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document to the unit document center' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async uploadDocument(
    @Param('unitId') unitId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('name') name: string,
    @Body('description') description: string,
    @Body('folderId') folderId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.')
    if (!name) throw new BadRequestException('Nome do documento é obrigatório.')

    return this.documentsService.uploadDocument(
      unitId,
      folderId || null,
      file,
      name,
      description || undefined,
      user,
    )
  }

  @Delete('documents/:documentId')
  @ApiOperation({ summary: 'Delete a document' })
  deleteDocument(
    @Param('unitId') unitId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentsService.deleteDocument(unitId, documentId, user)
  }
}
