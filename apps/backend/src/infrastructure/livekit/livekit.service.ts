import { Injectable, Logger } from '@nestjs/common'
import { createHmac } from 'crypto'
import { RoomServiceClient } from 'livekit-server-sdk'

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

/**
 * Clock-skew tolerance for the token's `nbf` (not-before) claim. LiveKit
 * rejects tokens whose `nbf` is in the future relative to its own clock, so
 * if this host runs ahead the token reads as "invalid token" (observed in
 * dev with a ~2min drift when the OS time service was stopped). Backdating
 * `nbf` makes token issuance immune to drift (NTP blocked on the LAN, VM
 * resumed from suspend, etc.). 5min covers realistic drift; `exp` is
 * unaffected, so this does not extend the token's usable lifetime forward.
 */
const NBF_SKEW_SECONDS = 300

/** Parse a ttl like "1h" / "30m" / "45s" / number(seconds) into seconds. */
function ttlToSeconds(ttl: string | undefined, fallback: number): number {
  if (!ttl) return fallback
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(ttl.trim())
  if (!match) return fallback
  const value = Number(match[1])
  const unit = match[2] ?? 's'
  const multiplier = unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1
  return value * multiplier
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * True when a LiveKit error means "this room does not exist" (never created or
 * already emptied by LiveKit) — the only error countParticipants treats as 0.
 * Everything else (network, auth, 5xx) is a real failure and must propagate.
 */
function isRoomNotFound(err: unknown): boolean {
  const e = err as { code?: string | number; status?: number; message?: string }
  if (e?.code === 'not_found' || e?.status === 404) return true
  const msg = (e?.message ?? '').toLowerCase()
  return msg.includes('does not exist') || msg.includes('not found')
}

@Injectable()
export class LiveKitService {
  private readonly logger = new Logger(LiveKitService.name)
  private roomServiceClient?: RoomServiceClient

  private get apiKey() { return process.env.LIVEKIT_API_KEY ?? 'devkey' }
  private get apiSecret() { return process.env.LIVEKIT_API_SECRET ?? 'devsecret' }
  get wsUrl() { return process.env.LIVEKIT_WS_URL ?? 'ws://localhost:7880' }

  /** HTTP(S) base URL for the server API (RoomService). */
  private get httpUrl() {
    const explicit = process.env.LIVEKIT_URL
    if (explicit) return explicit
    return this.wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:')
  }

  private get roomService(): RoomServiceClient {
    if (!this.roomServiceClient) {
      this.roomServiceClient = new RoomServiceClient(this.httpUrl, this.apiKey, this.apiSecret)
    }
    return this.roomServiceClient
  }

  /**
   * Real participant count in a room, straight from LiveKit (the source of
   * truth for presence). A missing room (never created or already emptied by
   * LiveKit) means "nobody", so it returns 0. Any OTHER error (network blip,
   * auth, 5xx) is re-thrown so callers fail open and do NOT mistake a
   * transient outage for an empty room — never close a live call on a blip.
   */
  async countParticipants(room: string): Promise<number> {
    try {
      const participants = await this.roomService.listParticipants(room)
      return participants.length
    } catch (err) {
      if (isRoomNotFound(err)) return 0
      throw err
    }
  }

  /** Force-close a room, disconnecting any lingering participants. Idempotent. */
  async deleteRoom(room: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(room)
    } catch (err) {
      // Already gone is fine — closing an absent room is a no-op for us.
      this.logger.debug?.(`deleteRoom(${room}) ignored (${(err as Error).message})`)
    }
  }

  /**
   * Sign a LiveKit access token directly (HS256) instead of via
   * `livekit-server-sdk`'s AccessToken, because the SDK hardcodes
   * `nbf = now` and exposes no way to backdate it. See NBF_SKEW_SECONDS.
   */
  async createToken(input: LiveKitTokenInput): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const ttlSeconds = ttlToSeconds(input.ttl, 2 * 3600)

    // Backdate BOTH `nbf` and `iat`: LiveKit rejects a token whose `iat` is
    // in the future relative to its clock, just like a future `nbf`.
    const issuedAt = now - NBF_SKEW_SECONDS
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const payload = base64url(
      JSON.stringify({
        iss: this.apiKey,
        sub: input.identity,
        identity: input.identity,
        name: input.name,
        nbf: issuedAt,
        iat: issuedAt,
        exp: now + ttlSeconds,
        video: input.grants,
      }),
    )

    const signingInput = `${header}.${payload}`
    const signature = base64url(createHmac('sha256', this.apiSecret).update(signingInput).digest())
    return `${signingInput}.${signature}`
  }
}
