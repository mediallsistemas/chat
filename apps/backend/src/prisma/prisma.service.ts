import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient, Prisma } from '@prisma/client'
import { getCurrentTenantId } from '../shared/tenant/tenant-context'

/**
 * Models that carry a denormalized `tenant_id` column (multitenancy plano 23.x).
 * Keep in sync with prisma/schema/*.prisma. `Tenant` itself is intentionally
 * absent (no tenant_id; platform-level code reads it unscoped).
 */
const TENANT_MODELS = new Set<string>([
  'Unit', 'User', 'UserUnit', 'AuditLog', 'DocumentFolder', 'Document',
  'Group', 'GroupMember', 'Message', 'MessageReaction', 'MessageBookmark', 'CustomEmoji', 'Huddle', 'ChatReminder',
  'UserConsent', 'KanbanBoard', 'KanbanColumn', 'Task', 'TaskDependency', 'TaskChecklist', 'TaskFile',
  'Meeting', 'MeetingParticipant', 'MeetingChatMessage', 'NotificationSetting', 'PushSubscription', 'Notification',
  'TaskImpediment', 'Ticket', 'TicketComment',
  'StrategicPlan', 'Objective', 'Goal', 'PlanPhase', 'PhaseScopeBoard', 'MacroTask',
  'PlanProgressSnapshot',
])

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
      ],
    })
    this.applyTenantScope()
  }

  async onModuleInit() {
    await this.$connect()

    this.$on('query' as never, (e: { duration: number; query: string }) => {
      if (e.duration > 500) {
        this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`)
      }
    })
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  /**
   * Multitenancy plano 23.3 — auto-scope every query to the request's tenant.
   *
   * Reads the tenant from AsyncLocalStorage (set by TenantGuard, plano 23.2). With
   * no tenant context (login, cron jobs, sockets) it does nothing — those paths keep
   * their explicit scoping. This does NOT replace the manual `unitId` filter
   * (security.md §5); it adds the tenant boundary on top of it.
   *
   * Transition-safe: during the nullable phase it scopes reads to "my tenant OR
   * untagged (tenant_id IS NULL)" so legacy rows and rows created via nested writes
   * are never hidden. Once the columns are NOT NULL — and before onboarding a 2nd
   * tenant — tighten `tenantWhere` to `{ tenantId: tid }` and drop the null branch.
   *
   * Uses `$use` middleware (not a client extension) for clean integration with this
   * injectable PrismaService and because middleware can post-filter `findUnique`
   * results by PK (which cannot accept a non-unique `where`).
   */
  private applyTenantScope() {
    this.$use(async (params, next) => {
      const tid = getCurrentTenantId()
      if (!tid || !params.model || !TENANT_MODELS.has(params.model)) {
        return next(params)
      }

      const action = params.action
      const tenantWhere = { OR: [{ tenantId: tid }, { tenantId: null }] }

      switch (action) {
        // Operations with a flexible `where` → AND the tenant condition in.
        case 'findMany':
        case 'findFirst':
        case 'findFirstOrThrow':
        case 'count':
        case 'aggregate':
        case 'groupBy':
        case 'updateMany':
        case 'deleteMany': {
          params.args = params.args ?? {}
          params.args.where = params.args.where
            ? { AND: [params.args.where, tenantWhere] }
            : tenantWhere
          return next(params)
        }

        // Row-creating writes → stamp tenantId (explicit data.tenantId still wins).
        case 'create': {
          params.args = params.args ?? {}
          params.args.data = { tenantId: tid, ...params.args.data }
          return next(params)
        }
        case 'createMany': {
          params.args = params.args ?? {}
          const data = params.args.data
          params.args.data = Array.isArray(data)
            ? data.map((d: Record<string, unknown>) => ({ tenantId: tid, ...d }))
            : { tenantId: tid, ...data }
          return next(params)
        }
        case 'upsert': {
          params.args = params.args ?? {}
          if (params.args.create) {
            params.args.create = { tenantId: tid, ...params.args.create }
          }
          // Unique `where` + `update` branch can't be tenant-filtered here;
          // covered by service-level scoped reads + RLS (plano 23.5).
          return next(params)
        }

        // PK lookups can't take a non-unique `where` → post-filter the result.
        case 'findUnique':
        case 'findUniqueOrThrow': {
          const result = await next(params)
          if (result && result.tenantId != null && result.tenantId !== tid) {
            if (action === 'findUniqueOrThrow') {
              throw new Prisma.PrismaClientKnownRequestError(
                `No ${params.model} found for the current tenant`,
                { code: 'P2025', clientVersion: Prisma.prismaVersion.client },
              )
            }
            return null
          }
          return result
        }

        // update / delete by unique `where` (id) can't be tenant-filtered here.
        // Rely on a prior tenant-scoped read in the service + RLS (plano 23.5).
        default:
          return next(params)
      }
    })
  }
}
