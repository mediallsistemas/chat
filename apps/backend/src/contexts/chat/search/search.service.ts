import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { JwtPayload } from '@mediall/types'
import { SearchMessagesDto } from './dto/search.dto'

const PAGE_SIZE = 40

interface SearchRow {
  id: string
  group_id: string
  sender_id: string
  content: string
  headline: string
  rank: number
  created_at: Date
  sender_name: string
  sender_avatar_url: string | null
  group_name: string
}

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(unitId: string, user: JwtPayload, dto: SearchMessagesDto) {
    const take = PAGE_SIZE + 1
    const cursor = dto.cursor ? this.decodeCursor(dto.cursor) : null
    const fromDate = dto.from ? new Date(dto.from) : null
    const toDate = dto.to ? new Date(dto.to) : null

    // Build SQL conditionals piecemeal so we keep parameterization safe.
    // user.sub gates results to groups where the user is a member; unitId
    // gates to the active unit. Both come from JwtPayload — never trust the
    // route param for the actual filter.
    const rows = await this.prisma.$queryRaw<SearchRow[]>`
      SELECT
        m.id,
        m.group_id,
        m.sender_id,
        m.content,
        ts_headline(
          'portuguese',
          unaccent(coalesce(m.content, '')),
          plainto_tsquery('portuguese', unaccent(${dto.q})),
          'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=20, MinWords=5'
        ) AS headline,
        ts_rank(m.search_vector, plainto_tsquery('portuguese', unaccent(${dto.q}))) AS rank,
        m.created_at,
        u.name           AS sender_name,
        u.avatar_url     AS sender_avatar_url,
        g.name           AS group_name
      FROM "chat_messages" m
      JOIN "users"       u ON u.id = m.sender_id
      JOIN "chat_groups" g ON g.id = m.group_id
      JOIN "chat_group_members" gm
           ON gm.group_id = m.group_id AND gm.user_id = ${user.sub}::text
      WHERE g.unit_id = ${unitId}::text
        AND m.is_deleted = false
        AND m.search_vector @@ plainto_tsquery('portuguese', unaccent(${dto.q}))
        ${dto.groupId ? Prisma.sql`AND m.group_id = ${dto.groupId}::text` : Prisma.empty}
        ${fromDate ? Prisma.sql`AND m.created_at >= ${fromDate}` : Prisma.empty}
        ${toDate   ? Prisma.sql`AND m.created_at <= ${toDate}`   : Prisma.empty}
        ${cursor
          ? Prisma.sql`AND (
              ts_rank(m.search_vector, plainto_tsquery('portuguese', unaccent(${dto.q}))) < ${cursor.rank}
              OR (ts_rank(m.search_vector, plainto_tsquery('portuguese', unaccent(${dto.q}))) = ${cursor.rank}
                  AND m.id > ${cursor.id}::text)
            )`
          : Prisma.empty}
      ORDER BY rank DESC, m.id ASC
      LIMIT ${take}
    `

    const hasMore = rows.length > PAGE_SIZE
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows
    const last = page[page.length - 1]

    return {
      results: page.map((r) => ({
        id: r.id,
        groupId: r.group_id,
        groupName: r.group_name,
        senderId: r.sender_id,
        senderName: r.sender_name,
        senderAvatarUrl: r.sender_avatar_url,
        content: r.content,
        headline: r.headline,
        rank: r.rank,
        createdAt: r.created_at.toISOString(),
      })),
      nextCursor: hasMore && last ? this.encodeCursor(last.id, last.rank) : null,
    }
  }

  private encodeCursor(id: string, rank: number): string {
    return Buffer.from(`${id}:${rank}`).toString('base64url')
  }

  private decodeCursor(cursor: string): { id: string; rank: number } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
      const [id, rankStr] = decoded.split(':')
      const rank = Number(rankStr)
      if (!id || !Number.isFinite(rank)) return null
      return { id, rank }
    } catch {
      return null
    }
  }
}
