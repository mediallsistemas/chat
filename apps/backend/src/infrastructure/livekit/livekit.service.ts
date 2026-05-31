import { Injectable } from '@nestjs/common'
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'

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

  // Server API runs over HTTP(S); derive it from the WS URL unless overridden.
  private get httpUrl() {
    return process.env.LIVEKIT_HOST ?? this.wsUrl.replace(/^ws(s)?:\/\//, 'http$1://')
  }

  private roomService?: RoomServiceClient

  private getRoomService(): RoomServiceClient {
    if (!this.roomService) {
      this.roomService = new RoomServiceClient(this.httpUrl, this.apiKey, this.apiSecret)
    }
    return this.roomService
  }

  async createToken(input: LiveKitTokenInput): Promise<string> {
    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity: input.identity,
      name: input.name,
      ttl: input.ttl ?? '2h',
    })
    token.addGrant(input.grants)
    return token.toJwt()
  }

  /**
   * Authoritative list of participant identities currently connected to a room.
   * Returns `null` when the LiveKit server API is unreachable (e.g. local dev
   * without LiveKit running) so callers can fall back instead of assuming empty.
   */
  async listParticipantIdentities(roomId: string): Promise<string[] | null> {
    try {
      const participants = await this.getRoomService().listParticipants(roomId)
      return participants.map((p) => p.identity)
    } catch {
      return null
    }
  }

  /** Best-effort teardown of a LiveKit room. Ignores "already gone" errors. */
  async endRoom(roomId: string): Promise<void> {
    try {
      await this.getRoomService().deleteRoom(roomId)
    } catch {
      // Room may already be empty/destroyed — nothing to do.
    }
  }
}
