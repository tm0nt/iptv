import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const skipDbDuringBuild =
  process.env.SKIP_DB_DURING_BUILD === 'true' ||
  process.env.npm_lifecycle_event === 'build' ||
  process.env.NEXT_PHASE === 'phase-production-build'

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: skipDbDuringBuild
      ? []
      : process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
