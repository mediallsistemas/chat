import { PrismaClient, UserRole, AccessScope, UnitType } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { ensureTenantAndBackfill } from './tenant-backfill'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  const hash = async (pw: string) => bcrypt.hash(pw, 12)

  // ─── Users ───────────────────────────────────────────────────────────────────

  const admin = await prisma.user.upsert({
    where: { email: 'admin@mediall.com.br' },
    update: { avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg' },
    create: {
      name: 'Administrador',
      email: 'admin@mediall.com.br',
      passwordHash: await hash('Admin@123'),
      accessScope: AccessScope.GLOBAL,
      avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
  })

  const rafael = await prisma.user.upsert({
    where: { email: 'rafael@gmail.com' },
    update: { avatarUrl: 'https://randomuser.me/api/portraits/men/45.jpg' },
    create: {
      name: 'Rafael Moreira',
      email: 'rafael@gmail.com',
      passwordHash: await hash('Mediall@2026'),
      accessScope: AccessScope.GLOBAL,
      avatarUrl: 'https://randomuser.me/api/portraits/men/45.jpg',
    },
  })

  const gabriel = await prisma.user.upsert({
    where: { email: 'gabriel@gmail.com' },
    update: { avatarUrl: 'https://randomuser.me/api/portraits/men/78.jpg' },
    create: {
      name: 'Gabriel Araujo',
      email: 'gabriel@gmail.com',
      passwordHash: await hash('Mediall@2026'),
      accessScope: AccessScope.GLOBAL,
      avatarUrl: 'https://randomuser.me/api/portraits/men/78.jpg',
    },
  })

  const gerenteEnfermagem = await prisma.user.upsert({
    where: { email: 'gerente.enfermagem@mediall.com.br' },
    update: { avatarUrl: 'https://randomuser.me/api/portraits/women/21.jpg' },
    create: {
      name: 'Gerente de Enfermagem',
      email: 'gerente.enfermagem@mediall.com.br',
      passwordHash: await hash('Mediall@2026'),
      accessScope: AccessScope.SINGLE,
      avatarUrl: 'https://randomuser.me/api/portraits/women/21.jpg',
    },
  })

  const gerenteProntoSocorro = await prisma.user.upsert({
    where: { email: 'gerente.ps@mediall.com.br' },
    update: { avatarUrl: 'https://randomuser.me/api/portraits/men/12.jpg' },
    create: {
      name: 'Gerente Pronto Socorro',
      email: 'gerente.ps@mediall.com.br',
      passwordHash: await hash('Mediall@2026'),
      accessScope: AccessScope.SINGLE,
      avatarUrl: 'https://randomuser.me/api/portraits/men/12.jpg',
    },
  })

  const diretorFinanceiro = await prisma.user.upsert({
    where: { email: 'diretor.financeiro@mediall.com.br' },
    update: { avatarUrl: 'https://randomuser.me/api/portraits/men/57.jpg' },
    create: {
      name: 'Diretor Financeiro',
      email: 'diretor.financeiro@mediall.com.br',
      passwordHash: await hash('Mediall@2026'),
      accessScope: AccessScope.MULTI,
      avatarUrl: 'https://randomuser.me/api/portraits/men/57.jpg',
    },
  })

  const diretorOperacional = await prisma.user.upsert({
    where: { email: 'diretor.operacional@mediall.com.br' },
    update: { avatarUrl: 'https://randomuser.me/api/portraits/men/63.jpg' },
    create: {
      name: 'Diretor Operacional',
      email: 'diretor.operacional@mediall.com.br',
      passwordHash: await hash('Mediall@2026'),
      accessScope: AccessScope.GLOBAL,
      avatarUrl: 'https://randomuser.me/api/portraits/men/63.jpg',
    },
  })

  const gerenteCCIH = await prisma.user.upsert({
    where: { email: 'gerente.ccih@mediall.com.br' },
    update: { avatarUrl: 'https://randomuser.me/api/portraits/women/55.jpg' },
    create: {
      name: 'Gerente CCIH',
      email: 'gerente.ccih@mediall.com.br',
      passwordHash: await hash('Mediall@2026'),
      accessScope: AccessScope.MULTI,
      avatarUrl: 'https://randomuser.me/api/portraits/women/55.jpg',
    },
  })

  console.log('✅ Users created')

  // ─── Matriz ───────────────────────────────────────────────────────────────────

  const matriz = await prisma.unit.upsert({
    where: { id: 'unit-matriz-mediall' },
    update: {},
    create: {
      id: 'unit-matriz-mediall',
      name: 'Mediall Brasil (Matriz)',
      type: UnitType.MATRIZ,
      managerId: gabriel.id,
    },
  })

  // ─── Unidades ─────────────────────────────────────────────────────────────────

  const units = await Promise.all([
    prisma.unit.upsert({
      where: { id: 'unit-uei' },
      update: {},
      create: {
        id: 'unit-uei',
        name: 'UEI',
        type: UnitType.UNIDADE,
        parentId: matriz.id,
        managerId: diretorOperacional.id,
      },
    }),
    prisma.unit.upsert({
      where: { id: 'unit-hrgm' },
      update: {},
      create: {
        id: 'unit-hrgm',
        name: 'HRGM',
        type: UnitType.UNIDADE,
        parentId: matriz.id,
        managerId: diretorOperacional.id,
      },
    }),
    prisma.unit.upsert({
      where: { id: 'unit-hmmdo' },
      update: {},
      create: {
        id: 'unit-hmmdo',
        name: 'HMMDO',
        type: UnitType.UNIDADE,
        parentId: matriz.id,
        managerId: diretorOperacional.id,
      },
    }),
    prisma.unit.upsert({
      where: { id: 'unit-hrpg' },
      update: {},
      create: {
        id: 'unit-hrpg',
        name: 'HRPG',
        type: UnitType.UNIDADE,
        parentId: matriz.id,
        managerId: diretorOperacional.id,
      },
    }),
    prisma.unit.upsert({
      where: { id: 'unit-upa-zona-sul' },
      update: {},
      create: {
        id: 'unit-upa-zona-sul',
        name: 'UPA Zona Sul',
        type: UnitType.UNIDADE,
        parentId: matriz.id,
        managerId: diretorOperacional.id,
      },
    }),
  ])

  const [uei, hrgm, hmmdo, hrpg, upaZonaSul] = units
  console.log('✅ Units created')

  // ─── UserUnit assignments ─────────────────────────────────────────────────────

  const allUnitIds = [uei.id, hrgm.id, hmmdo.id, hrpg.id, upaZonaSul.id]

  // Admin — SUPER_ADMIN on all units
  for (const unitId of allUnitIds) {
    await prisma.userUnit.upsert({
      where: { userId_unitId: { userId: admin.id, unitId } },
      update: {},
      create: {
        userId: admin.id,
        unitId,
        role: UserRole.SUPER_ADMIN,
        isPrimary: unitId === uei.id,
        grantedBy: admin.id,
      },
    })
  }

  // Rafael — SUPER_ADMIN on all units
  for (const unitId of allUnitIds) {
    await prisma.userUnit.upsert({
      where: { userId_unitId: { userId: rafael.id, unitId } },
      update: {},
      create: {
        userId: rafael.id,
        unitId,
        role: UserRole.SUPER_ADMIN,
        isPrimary: unitId === uei.id,
        grantedBy: rafael.id,
      },
    })
  }

  // Gabriel — DIRETORIA on all units
  for (const unitId of allUnitIds) {
    await prisma.userUnit.upsert({
      where: { userId_unitId: { userId: gabriel.id, unitId } },
      update: {},
      create: {
        userId: gabriel.id,
        unitId,
        role: UserRole.DIRETORIA,
        isPrimary: unitId === uei.id,
        grantedBy: rafael.id,
      },
    })
  }

  // Gerente Enfermagem — GESTOR on UEI
  await prisma.userUnit.upsert({
    where: { userId_unitId: { userId: gerenteEnfermagem.id, unitId: uei.id } },
    update: {},
    create: {
      userId: gerenteEnfermagem.id,
      unitId: uei.id,
      role: UserRole.GESTOR,
      isPrimary: true,
      grantedBy: rafael.id,
    },
  })

  // Gerente Pronto Socorro — GESTOR on HRGM
  await prisma.userUnit.upsert({
    where: { userId_unitId: { userId: gerenteProntoSocorro.id, unitId: hrgm.id } },
    update: {},
    create: {
      userId: gerenteProntoSocorro.id,
      unitId: hrgm.id,
      role: UserRole.GESTOR,
      isPrimary: true,
      grantedBy: rafael.id,
    },
  })

  // Diretor Financeiro — DIRETORIA on UEI + HRGM
  for (const unitId of [uei.id, hrgm.id]) {
    await prisma.userUnit.upsert({
      where: { userId_unitId: { userId: diretorFinanceiro.id, unitId } },
      update: {},
      create: {
        userId: diretorFinanceiro.id,
        unitId,
        role: UserRole.DIRETORIA,
        isPrimary: unitId === uei.id,
        grantedBy: rafael.id,
      },
    })
  }

  // Diretor Operacional — DIRETORIA on all
  for (const unitId of allUnitIds) {
    await prisma.userUnit.upsert({
      where: { userId_unitId: { userId: diretorOperacional.id, unitId } },
      update: {},
      create: {
        userId: diretorOperacional.id,
        unitId,
        role: UserRole.DIRETORIA,
        isPrimary: unitId === uei.id,
        grantedBy: rafael.id,
      },
    })
  }

  // Gerente CCIH — GESTOR on HMMDO + HRPG
  for (const unitId of [hmmdo.id, hrpg.id]) {
    await prisma.userUnit.upsert({
      where: { userId_unitId: { userId: gerenteCCIH.id, unitId } },
      update: {},
      create: {
        userId: gerenteCCIH.id,
        unitId,
        role: UserRole.GESTOR,
        isPrimary: unitId === hmmdo.id,
        grantedBy: rafael.id,
      },
    })
  }

  console.log('✅ UserUnit assignments created')

  // ─── Multitenancy (plano 23.x) ────────────────────────────────────────────────
  // Seed uses a raw PrismaClient (no tenant middleware), so rows are created with
  // tenant_id NULL. Tag them all here so login works (a user needs a tenant).
  await ensureTenantAndBackfill(prisma)
  console.log('✅ Tenant assigned')

  // ─── Summary ──────────────────────────────────────────────────────────────────

  console.log('\n📋 Seed summary:')
  console.log('   Users')
  console.log(`   - admin@mediall.com.br    → SUPER_ADMIN / GLOBAL  (Admin@123)`)
  console.log(`   - rafael@gmail.com        → SUPER_ADMIN / GLOBAL  (Mediall@2026)`)
  console.log(`   - gabriel@gmail.com       → DIRETORIA  / GLOBAL`)
  console.log(`   - diretor.operacional@    → DIRETORIA  / GLOBAL`)
  console.log(`   - diretor.financeiro@     → DIRETORIA  / MULTI (UEI + HRGM)`)
  console.log(`   - gerente.ccih@           → GESTOR     / MULTI (HMMDO + HRPG)`)
  console.log(`   - gerente.enfermagem@     → GESTOR     / SINGLE (UEI)`)
  console.log(`   - gerente.ps@             → GESTOR     / SINGLE (HRGM)`)
  console.log('\n   Units: Matriz → UEI, HRGM, HMMDO, HRPG, UPA Zona Sul')
  console.log('\n✅ Seed complete')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
