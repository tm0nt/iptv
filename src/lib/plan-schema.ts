import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

let ensurePromise: Promise<void> | null = null

export async function ensurePlanSchema() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "plans"
        ADD COLUMN IF NOT EXISTS "adminOnly" BOOLEAN NOT NULL DEFAULT FALSE;
      `)

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "plans"
        ADD COLUMN IF NOT EXISTS "isUnlimited" BOOLEAN NOT NULL DEFAULT FALSE;
      `)

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "plans_active_adminOnly_idx"
        ON "plans" ("active", "adminOnly");
      `)
    })().catch((error) => {
      ensurePromise = null
      throw error
    })
  }

  return ensurePromise
}

export type PlanFlags = {
  id: string
  adminOnly: boolean
  isUnlimited: boolean
}

export async function getPlanFlagsMap(planIds: string[]) {
  await ensurePlanSchema()

  if (planIds.length === 0) {
    return new Map<string, PlanFlags>()
  }

  const rows = await prisma.$queryRaw<Array<PlanFlags>>`
    SELECT
      "id",
      "adminOnly",
      "isUnlimited"
    FROM "plans"
    WHERE "id" IN (${Prisma.join(planIds)})
  `

  return new Map(rows.map((row) => [row.id, row]))
}

export async function getPlanFlags(planId?: string | null) {
  if (!planId) {
    return { id: '', adminOnly: false, isUnlimited: false }
  }

  const map = await getPlanFlagsMap([planId])
  return map.get(planId) || { id: planId, adminOnly: false, isUnlimited: false }
}

export async function updatePlanFlags(planId: string, flags: Omit<PlanFlags, 'id'>) {
  await ensurePlanSchema()
  await prisma.$executeRaw`
    UPDATE "plans"
    SET
      "adminOnly" = ${flags.adminOnly},
      "isUnlimited" = ${flags.isUnlimited}
    WHERE "id" = ${planId}
  `
}
