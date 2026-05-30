import { Injectable } from '@nestjs/common'
import { AccessToken } from 'livekit-server-sdk'

export interface LiveKitGrants {
  roomJoin: boolean
  room: string
  canPublish: boolean
  canSubscribe: boolean
  canPublishData?: boolean
}

export interface LiveKitTokenInput {
  identity: string
  name: string
  ttl?: string
  grants: LiveKitGrants
}

@Injectable()
export class LiveKitService {
  private get apiKey() { return process.env.LIVEKIT_API_KEY ?? 'devkey' }
  private get apiSecret() { return process.env.LIVEKIT_API_SECRET ?? 'devsecret' }
  get wsUrl() { return process.env.LIVEKIT_WS_URL ?? 'ws://localhost:7880' }

  async createToken(input: LiveKitTokenInput): Promise<string> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: input.identity,
      name: input.name,
      ttl: input.ttl ?? '2h',
    })
    token.addGrant(input.grants)
    return token.toJwt()
  }
}
