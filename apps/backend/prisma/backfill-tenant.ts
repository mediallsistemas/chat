/**
 * Standalone tenant backfill (multitenancy plano 23.1).
 *
 * Creates the default tenant for existing single-tenant data and sets `tenant_id`
 * on every row that still has it NULL. Run AFTER `prisma generate` and the migration
 * that adds the nullable columns, and BEFORE the future NOT NULL migration.
 *
 *   npx ts-node prisma/backfill-tenant.ts     (ou: npm run db:backfill-tenant)
 *
 * Idempotente. A lógica vive em ./tenant-backfill (compartilhada com o seed).
 */
import { PrismaClient } from '@prisma/client'
import { ensureTenantAndBackfill } from './tenant-backfill'

const prisma = new PrismaClient()

ensureTenantAndBackfill(prisma)
  .then(() => console.log('✓ Concluído.'))
  .catch((e) => {
    console.error('✗ Backfill falhou:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
