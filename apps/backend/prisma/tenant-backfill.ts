import { PrismaClient } from '@prisma/client'

const DEFAULT_TENANT = { name: 'Mediall Brasil', slug: 'mediall' }

// Prisma model accessors (camelCase) that carry a tenant_id column.
// Keep in sync with prisma/schema/*.prisma and PrismaService.TENANT_MODELS.
const MODELS = [
  'unit', 'user', 'userUnit',
  'auditLog',
  'documentFolder', 'document',
  'group', 'groupMember', 'message', 'messageReaction', 'messageBookmark', 'customEmoji', 'huddle', 'chatReminder',
  'userConsent',
  'kanbanBoard', 'kanbanColumn', 'task', 'taskDependency', 'taskChecklist', 'taskFile',
  'meeting', 'meetingParticipant', 'meetingChatMessage',
  'notificationSetting', 'pushSubscription', 'notification',
  'taskImpediment',
  'ticket', 'ticketComment',
  'strategicPlan', 'objective', 'goal', 'planPhase', 'phaseScopeBoard', 'macroTask',
] as const

/**
 * Creates the default tenant (if missing) and sets `tenant_id` on every row that
 * still has it NULL. Idempotent. Shared by the standalone backfill script and the
 * seed — so `db:seed` never leaves users without a tenant (which would block login,
 * plano 23.2). Must run before the future migration that makes tenant_id NOT NULL.
 */
export async function ensureTenantAndBackfill(prisma: PrismaClient): Promise<string> {
  let tenant = await prisma.tenant.findUnique({ where: { slug: DEFAULT_TENANT.slug } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: DEFAULT_TENANT.name,
        slug: DEFAULT_TENANT.slug,
        status: 'ACTIVE',
        planTier: 'ENTERPRISE',
        maxUnits: 9999,
        maxUsers: 9999,
      },
    })
    console.log(`✓ Tenant criado: ${tenant.name} (${tenant.id})`)
  } else {
    console.log(`• Tenant já existe: ${tenant.name} (${tenant.id})`)
  }

  let total = 0
  for (const m of MODELS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (prisma as any)[m].updateMany({
      where: { tenantId: null },
      data: { tenantId: tenant.id },
    })
    total += res.count
  }
  console.log(`✓ Backfill de tenant: ${total} linhas atualizadas.`)
  return tenant.id
}
