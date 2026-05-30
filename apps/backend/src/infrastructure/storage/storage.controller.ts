import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiConsumes } from '@nestjs/swagger'
import { BaseUnitController } from '../../shared/controllers/base-unit.controller'
import { StorageService } from './storage.service'
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
export class StorageController extends BaseUnitController {
  constructor(private storageService: StorageService) {
    super()
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async upload(
    @Param('unitId') unitId: string,
    @UploadedFile() file: MulterFile,
    @Query('sensitive') sensitive?: string,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado.')

    const ext = file.originalname.split('.').pop() ?? 'bin'
    const isSensitive = sensitive === 'true' || sensitive === '1'
    const key = `${unitId}/${isSensitive ? 'enc/' : ''}${randomUUID()}.${ext}`

    if (isSensitive) {
      await this.storageService.uploadEncrypted(key, file.buffer, file.mimetype)
      return {
        key,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        sensitive: true,
        // Encrypted files must be downloaded via the /download/:key endpoint, not direct signed URLs
        url: null,
      }
    }

    await this.storageService.upload(key, file.buffer, file.mimetype)
    const url = await this.storageService.getSignedUrl(key)

    return {
      key,
      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      sensitive: false,
      url,
    }
  }

  // Proxy download for AES-256-GCM encrypted files — decrypts in-flight, never exposes raw ciphertext
  @Get('download/:key(*)')
  async download(
    @Param('unitId') unitId: string,
    @Param('key') key: string,
    @Res() res: Response,
  ) {
    const fullKey = key.startsWith(unitId) ? key : `${unitId}/${key}`
    const { buffer, mimeType } = await this.storageService.downloadDecrypted(fullKey)
    res.set('Content-Type', mimeType)
    res.set('Content-Disposition', 'attachment')
    res.send(buffer)
  }
}
