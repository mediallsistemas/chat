import { Injectable, Logger } from '@nestjs/common'
import { createClient, type RedisClientType } from 'redis'

const PRESENCE_TTL = 60 * 60 * 24 // 24h safety TTL on the set key

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name)
  private redis: RedisClientType | null = null
  // Fallback when Redis is unavailable: unit → Set of userIds
  private localMap = new Map<string, Set<string>>()

  async connect() {
    const url = `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
    try {
      const client = createClient({ url }) as RedisClientType
      await client.connect()
      this.redis = client
      this.logger.log('Presence: Redis connected')
    } catch (err) {
      this.logger.warn('Presence: Redis unavailable — using in-memory fallback', (err as Error).message)
    }
  }

  async markOnline(unitId: string, userId: string): Promise<void> {
    if (this.redis) {
      const key = `online:unit:${unitId}`
      await this.redis.sAdd(key, userId)
      await this.redis.expire(key, PRESENCE_TTL)
    } else {
      const set = this.localMap.get(unitId) ?? new Set()
      set.add(userId)
      this.localMap.set(unitId, set)
    }
  }

  async markOffline(unitId: string, userId: string): Promise<void> {
    if (this.redis) {
      await this.redis.sRem(`online:unit:${unitId}`, userId)
    } else {
      this.localMap.get(unitId)?.delete(userId)
    }
  }

  async getOnlineUsers(unitId: string): Promise<string[]> {
    if (this.redis) {
      return this.redis.sMembers(`online:unit:${unitId}`)
    }
    return Array.from(this.localMap.get(unitId) ?? [])
  }

  async getAllOnlineUsers(): Promise<string[]> {
    if (this.redis) {
      const keys = await this.redis.keys('online:unit:*')
      if (!keys.length) return []
      const results = await Promise.all(keys.map((k) => this.redis!.sMembers(k)))
      return [...new Set(results.flat())]
    }
    const all = new Set<string>()
    for (const set of this.localMap.values()) set.forEach((id) => all.add(id))
    return Array.from(all)
  }
}
