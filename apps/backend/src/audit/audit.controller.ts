import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { PrismaService } from '../prisma/prisma.service'
import { BaseUnitController } from '../shared/controllers/base-unit.controller'
import { Roles } from '../shared/decorators/roles.decorator'
import { UserRole } from '@mediall/types'

class AuditLogsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50

  @IsOptional()
  @IsString()
  action?: string

  @IsOptional()
  @IsString()
  entityType?: string

  @IsOptional()
  @IsString()
  userId?: string
}

@ApiTags('audit')
@Controller('units/:unitId')
export class AuditController extends BaseUnitController {
  constructor(private prisma: PrismaService) {
    super()
  }

  @Get('audit-logs')
  @Roles(UserRole.SUPER_ADMIN, UserRole.DIRETORIA)
  async findAll(@Param('unitId') unitId: string, @Query() query: AuditLogsQuery) {
    const page = query.page ?? 1
    const limit = query.limit ?? 50
    const skip = (page - 1) * limit

    const where = {
      unitId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }
  }
}
