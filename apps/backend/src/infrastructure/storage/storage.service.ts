import { Injectable } from '@nestjs/common'
import * as Minio from 'minio'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const BUCKET = 'mediall-files'
const SIGNED_URL_EXPIRY = 3600 // 1 hour
const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const TAG_LEN = 16

@Injectable()
export class StorageService {
  private readonly client: Minio.Client
  private readonly encKey: Buffer

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.NODE_ENV === 'production',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    })
    // 32-byte key from env (hex) or a fixed dev default
    const hex = process.env.FILE_ENCRYPTION_KEY || '0'.repeat(64)
    this.encKey = Buffer.from(hex, 'hex')
  }

  async ensureBucket() {
    const exists = await this.client.bucketExists(BUCKET)
    if (!exists) {
      await this.client.makeBucket(BUCKET)
    }
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.ensureBucket()
    await this.client.putObject(BUCKET, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    })
  }

  // Encrypts with AES-256-GCM and stores IV + authTag + ciphertext as a single blob.
  async uploadEncrypted(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const iv = randomBytes(IV_LEN)
    const cipher = createCipheriv(ALGO, this.encKey, iv)
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
    const tag = cipher.getAuthTag()
    // Layout: [12 bytes IV][16 bytes tag][ciphertext]
    const blob = Buffer.concat([iv, tag, encrypted])
    await this.ensureBucket()
    await this.client.putObject(BUCKET, key, blob, blob.length, {
      'Content-Type': 'application/octet-stream',
      'x-amz-meta-original-mime': mimeType,
      'x-amz-meta-encrypted': 'aes-256-gcm',
    })
  }

  // Downloads and decrypts an AES-256-GCM encrypted blob.
  async downloadDecrypted(key: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const stream = await this.client.getObject(BUCKET, key)
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    const blob = Buffer.concat(chunks)

    const iv = blob.subarray(0, IV_LEN)
    const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN)
    const ciphertext = blob.subarray(IV_LEN + TAG_LEN)

    const decipher = createDecipheriv(ALGO, this.encKey, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])

    // Try to recover the original MIME from object stat
    const stat = await this.client.statObject(BUCKET, key)
    const mimeType = (stat.metaData?.['x-amz-meta-original-mime'] as string) ?? 'application/octet-stream'

    return { buffer: plaintext, mimeType }
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
