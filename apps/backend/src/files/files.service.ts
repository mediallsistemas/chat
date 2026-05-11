import { Injectable, InternalServerErrorException } from '@nestjs/common'
import * as Minio from 'minio'

const BUCKET = 'mediall-files'
const SIGNED_URL_EXPIRY = 3600 // 1 hour

@Injectable()
export class FilesService {
  private readonly client: Minio.Client

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.NODE_ENV === 'production',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    })
  }

  async ensureBucket() {
    const exists = await this.client.bucketExists(BUCKET)
    if (!exists) {
      await this.client.makeBucket(BUCKET)
    }
  }

  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    await this.ensureBucket()
    await this.client.putObject(BUCKET, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    })
  }

  async getSignedUrl(key: string): Promise<string> {
    return this.client.presignedGetObject(BUCKET, key, SIGNED_URL_EXPIRY)
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.removeObject(BUCKET, key)
    } catch {
      // Ignore if already gone
    }
  }
}
