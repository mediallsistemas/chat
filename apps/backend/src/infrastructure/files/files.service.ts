import { Injectable, InternalServerErrorException } from '@nestjs/common'
import * as Minio from 'minio'

const BUCKET = 'mediall-files'
const SIGNED_URL_EXPIRY = 3600 // 1 hour

@Injectable()
export class FilesService {
  // Used for all server-side object ops (upload/delete) — talks to MinIO directly.
  private readonly client: Minio.Client
  // Used ONLY to SIGN browser-facing GET URLs. When MINIO_PUBLIC_ENDPOINT is set,
  // it points at the public origin (reverse-proxied to MinIO at `^~ /<bucket>/`),
  // so the signed URL is reachable from the browser instead of `minio:9000`.
  // presignedGetObject signs offline (no network call), so a self-signed cert on
  // the proxy doesn't matter here — the browser performs the actual GET.
  private readonly signingClient: Minio.Client

  constructor() {
    const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin'
    const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin'
    // Pin the region so presignedGetObject signs fully offline. Without it,
    // minio-js issues a GetBucketLocation request against the endpoint — which,
    // for the public signing client, hits the self-signed TLS proxy and throws.
    const region = process.env.MINIO_REGION || 'us-east-1'

    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      // Internal MinIO (minio:9000) speaks plain HTTP. Tie TLS to an explicit
      // flag, not NODE_ENV — otherwise production forces HTTPS against a non-TLS
      // endpoint and every upload/signed-URL fails.
      useSSL: process.env.MINIO_USE_SSL === 'true',
      region,
      accessKey,
      secretKey,
    })

    const publicEndpoint = process.env.MINIO_PUBLIC_ENDPOINT
    this.signingClient = publicEndpoint
      ? new Minio.Client({
          endPoint: publicEndpoint,
          port: parseInt(process.env.MINIO_PUBLIC_PORT || '443', 10),
          useSSL: process.env.MINIO_PUBLIC_USE_SSL !== 'false',
          region,
          accessKey,
          secretKey,
        })
      : this.client
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
    return this.signingClient.presignedGetObject(BUCKET, key, SIGNED_URL_EXPIRY)
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.removeObject(BUCKET, key)
    } catch {
      // Ignore if already gone
    }
  }
}
