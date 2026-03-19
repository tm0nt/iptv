import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuditRetentionDays } from '@/lib/system-config'

type ActorLike = {
  id?: string | null
  email?: string | null
  role?: string | null
}

type AuditInput = {
  level?: 'INFO' | 'WARN' | 'ERROR'
  action: string
  entityType: string
  entityId?: string | null
  message: string
  actor?: ActorLike | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Prisma.InputJsonValue
}

type AuditRow = {
  id: string
  level: string
  action: string
  entityType: string
  entityId: string | null
  message: string
  actorId: string | null
  actorEmail: string | null
  actorRole: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: Prisma.JsonValue | null
  createdAt: Date
}

export type AuditAlert = {
  id: string
  level: 'INFO' | 'WARN' | 'ERROR'
  title: string
  description: string
  action?: string
  count: number
}

export type AuditHealthSummary = {
  errors24h: number
  warnings24h: number
  failedLogins24h: number
  playerErrors24h: number
  streamStarts1h: number
}

export function getAuditRequestContext(request?: NextRequest | Request | null) {
  if (!request) return { ipAddress: null, userAgent: null }

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null

  return {
    ipAddress,
    userAgent: request.headers.get('user-agent'),
  }
}

export async function logAuditEvent(input: AuditInput) {
  try {
    const metadata = input.metadata == null ? null : JSON.stringify(input.metadata)

    await prisma.$executeRaw`
      INSERT INTO "audit_logs" (
        "id", "level", "action", "entityType", "entityId", "message",
        "actorId", "actorEmail", "actorRole", "ipAddress", "userAgent", "metadata", "createdAt"
      )
      VALUES (
        ${randomUUID()},
        ${input.level || 'INFO'},
        ${input.action},
        ${input.entityType},
        ${input.entityId || null},
        ${input.message},
        ${input.actor?.id || null},
        ${input.actor?.email || null},
        ${input.actor?.role || null},
        ${input.ipAddress || null},
        ${input.userAgent || null},
        ${metadata}::jsonb,
        NOW()
      )
    `
  } catch (error) {
    console.error('[Audit] Failed to persist audit event:', error)
  }
}

export async function listAuditLogs(filters: {
  q?: string
  action?: string
  entityType?: string
  level?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}) {
  const q = filters.q?.trim() || ''
  const action = filters.action?.trim() || ''
  const entityType = filters.entityType?.trim() || ''
  const level = filters.level?.trim().toUpperCase() || ''
  const dateFrom = filters.dateFrom?.trim() || ''
  const dateTo = filters.dateTo?.trim() || ''
  const page = Math.max(1, filters.page || 1)
  const limit = Math.min(100, Math.max(10, filters.limit || 30))

  const conditions: Prisma.Sql[] = [Prisma.sql`1 = 1`]

  if (q) {
    const term = `%${q}%`
    conditions.push(
      Prisma.sql`(
        "message" ILIKE ${term}
        OR COALESCE("actorEmail", '') ILIKE ${term}
        OR COALESCE("entityId", '') ILIKE ${term}
        OR "action" ILIKE ${term}
      )`,
    )
  }
  if (action) conditions.push(Prisma.sql`"action" = ${action}`)
  if (entityType) conditions.push(Prisma.sql`"entityType" = ${entityType}`)
  if (level) conditions.push(Prisma.sql`"level" = ${level}`)
  if (dateFrom) conditions.push(Prisma.sql`"createdAt" >= ${new Date(dateFrom)}`)
  if (dateTo) {
    const inclusiveDateTo = new Date(dateTo)
    inclusiveDateTo.setHours(23, 59, 59, 999)
    conditions.push(Prisma.sql`"createdAt" <= ${inclusiveDateTo}`)
  }

  const whereSql = Prisma.join(conditions, ' AND ')
  const offset = (page - 1) * limit

  const logs = await prisma.$queryRaw<AuditRow[]>(Prisma.sql`
    SELECT *
    FROM "audit_logs"
    WHERE ${whereSql}
    ORDER BY "createdAt" DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)

  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total
    FROM "audit_logs"
    WHERE ${whereSql}
  `)

  const facetRows = await prisma.$queryRaw<Array<{ action: string; entityType: string }>>(Prisma.sql`
    SELECT "action", "entityType"
    FROM "audit_logs"
    ORDER BY "createdAt" DESC
    LIMIT 200
  `)

  return {
    logs,
    total: Number(countRows[0]?.total || 0),
    page,
    limit,
    actions: Array.from(new Set(facetRows.map(item => item.action))).slice(0, 50),
    entityTypes: Array.from(new Set(facetRows.map(item => item.entityType))).slice(0, 30),
  }
}

export async function getAuditHealthSummary(): Promise<AuditHealthSummary> {
  const now = new Date()
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000)
  const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [errors24h, warnings24h, failedLogins24h, playerErrors24h, streamStarts1h] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "audit_logs"
      WHERE "level" = 'ERROR'
        AND "createdAt" >= ${lastDay}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "audit_logs"
      WHERE "level" = 'WARN'
        AND "createdAt" >= ${lastDay}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "audit_logs"
      WHERE "action" = 'auth.login.failed'
        AND "createdAt" >= ${lastDay}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "audit_logs"
      WHERE "action" = 'player.error'
        AND "createdAt" >= ${lastDay}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "audit_logs"
      WHERE "action" = 'stream.watch.started'
        AND "createdAt" >= ${lastHour}
    `),
  ])

  return {
    errors24h: Number(errors24h[0]?.total || 0),
    warnings24h: Number(warnings24h[0]?.total || 0),
    failedLogins24h: Number(failedLogins24h[0]?.total || 0),
    playerErrors24h: Number(playerErrors24h[0]?.total || 0),
    streamStarts1h: Number(streamStarts1h[0]?.total || 0),
  }
}

export async function getAuditAlerts() {
  const now = new Date()
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000)
  const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const [failedLogins, settingsChanges, paymentErrors, streamStarts] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "audit_logs"
      WHERE "action" = 'auth.login.failed'
        AND "createdAt" >= ${lastDay}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "audit_logs"
      WHERE "action" = 'admin.settings.updated'
        AND "createdAt" >= ${lastDay}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "audit_logs"
      WHERE (
        "level" = 'ERROR'
        OR "action" IN ('payment.webhook.failed', 'payment.pix.failed')
      )
        AND "createdAt" >= ${lastDay}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM "audit_logs"
      WHERE "action" = 'stream.watch.started'
        AND "createdAt" >= ${lastHour}
    `),
  ])

  const alerts: AuditAlert[] = []
  const failedLoginCount = Number(failedLogins[0]?.total || 0)
  const settingsChangeCount = Number(settingsChanges[0]?.total || 0)
  const paymentErrorCount = Number(paymentErrors[0]?.total || 0)
  const streamStartCount = Number(streamStarts[0]?.total || 0)

  if (failedLoginCount > 0) {
    alerts.push({
      id: 'failed-logins',
      level: failedLoginCount >= 10 ? 'ERROR' : 'WARN',
      title: 'Tentativas de login falhas detectadas',
      description: `${failedLoginCount} tentativa(s) com falha nas ultimas 24 horas.`,
      action: 'auth.login.failed',
      count: failedLoginCount,
    })
  }

  if (paymentErrorCount > 0) {
    alerts.push({
      id: 'payment-errors',
      level: 'ERROR',
      title: 'Falhas em eventos de pagamento',
      description: `${paymentErrorCount} evento(s) de pagamento com erro nas ultimas 24 horas.`,
      action: 'payment.webhook.failed',
      count: paymentErrorCount,
    })
  }

  if (settingsChangeCount > 0) {
    alerts.push({
      id: 'settings-updates',
      level: 'INFO',
      title: 'Configuracoes do sistema alteradas',
      description: `${settingsChangeCount} alteracao(oes) administrativas registradas nas ultimas 24 horas.`,
      action: 'admin.settings.updated',
      count: settingsChangeCount,
    })
  }

  if (streamStartCount >= 25) {
    alerts.push({
      id: 'stream-spike',
      level: streamStartCount >= 100 ? 'WARN' : 'INFO',
      title: 'Pico recente de reproducoes',
      description: `${streamStartCount} inicios de stream registrados na ultima hora.`,
      action: 'stream.watch.started',
      count: streamStartCount,
    })
  }

  return alerts
}

export async function pruneAuditLogs() {
  const retentionDays = await getAuditRetentionDays()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  const result = await prisma.$executeRaw`
    DELETE FROM "audit_logs"
    WHERE "createdAt" < ${cutoff}
  `

  return { deleted: Number(result), retentionDays }
}

export async function createAuditSnapshot() {
  const now = new Date()

  const [users, activeSubscriptions, pendingPayments, channels, plans] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({
      where: { status: 'ACTIVE', expiresAt: { gt: now } },
    }),
    prisma.payment.count({
      where: { status: 'PENDING' },
    }),
    prisma.channel.count({
      where: { active: true },
    }),
    prisma.plan.count({
      where: { active: true },
    }),
  ])

  await logAuditEvent({
    action: 'system.snapshot',
    entityType: 'SYSTEM',
    message: 'Snapshot periódico da plataforma gerado pelo cron',
    actor: { role: 'SYSTEM', email: 'cron@system.local' },
    metadata: {
      users,
      activeSubscriptions,
      pendingPayments,
      channels,
      plans,
      capturedAt: now.toISOString(),
    },
  })

  return { users, activeSubscriptions, pendingPayments, channels, plans }
}
