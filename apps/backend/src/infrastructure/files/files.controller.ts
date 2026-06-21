import {
  Controller,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiConsumes } from '@nestjs/swagger'
import { BaseUnitController } from '../../shared/controllers/base-unit.controller'
import { FilesService } from './files.service'
import { getCurrentTenantId } from '../../shared/tenant/tenant-context'
import { randomUUID } from 'crypto'

interface MulterFile {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  buffer: Buffer
  size: number
}

const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

@ApiTags('files')
@Controller('units/:unitId')
export class FilesController extends BaseUnitController {
  constructor(private filesService: FilesService) {
    super()
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async upload(
    @Param('unitId') unitId: string,
    @UploadedFile() file: MulterFile,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.')

    const ext = file.originalname.split('.').pop() ?? 'bin'
    // Plano 23.6 — chave prefixada por tenant (isolamento no storage). Fallback sem
    // tenant preserva o comportamento antigo na transição; arquivos antigos seguem
    // resolvendo pela chave salva no DB.
    const tenantId = getCurrentTenantId()
    const key = tenantId
      ? `${tenantId}/${unitId}/${randomUUID()}.${ext}`
      : `${unitId}/${randomUUID()}.${ext}`

    await this.filesService.upload(key, file.buffer, file.mimetype)

    const url = await this.filesService.getSignedUrl(key)

    return {
      key,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url,
    }
  }
}
