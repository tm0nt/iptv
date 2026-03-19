import crypto from 'crypto'
import { randomUUID } from 'crypto'
import type { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'

const PROFILE_COOKIE = 'active_profile_id'
const VIEWER_COOKIE = 'viewer_key'
const SESSION_TTL_SECONDS = 45

type ActiveSubscription = {
  id: string
  planId: string
  status: string
  expiresAt: Date
  plan: {
    id: string
    name: string
    price: number
    maxDevices: number
    durationDays: number
    interval: string
  }
}

export type AccountProfileRow = {
  id: string
  userId: string
  name: string
  isDefault: boolean
  avatarColor: string
  createdAt: Date
  updatedAt: Date
}

export type ContinueWatchingItem = {
  channelUuid: string
  title: string
  subtitle: string
  contentType: 'LIVE' | 'MOVIE' | 'SERIES'
  artworkUrl: string | null
  progressPercent: number
  progressSeconds: number
  durationSeconds: number | null
  href: string
  lastWatchedAt: string
  isLive: boolean
}

export type AdminPlaybackUsageRow = {
  userId: string
  profilesCount: number
  activeSessionsCount: number
}

export type AdminPlaybackDetails = {
  profiles: Array<{
    id: string
    name: string
    avatarColor: string
    isDefault: boolean
    activeSessionCount: number
  }>
  activeSessions: Array<{
    id: string
    profileId: string
    profileName: string
    avatarColor: string
    channelUuid: string | null
    channelName: string | null
    contentType: string | null
    startedAt: string
    lastSeenAt: string
  }>
}

export type UserProfilePlaybackStatus = 'FREE' | 'CURRENT_SCREEN' | 'OTHER_SCREEN'

export type UserPlaybackOverview = {
  profiles: Array<{
    id: string
    name: string
    avatarColor: string
    isDefault: boolean
    activeSessionCount: number
    status: UserProfilePlaybackStatus
    statusLabel: string
  }>
  activeSessionsCount: number
}

const PROFILE_COLOR_PALETTE = [
  '#73de90',
  '#4f9cff',
  '#ff9f5a',
  '#f56565',
  '#8b5cf6',
  '#14b8a6',
  '#f59e0b',
  '#ec4899',
] as const

let initPromise: Promise<void> | null = null

export async function ensurePlaybackTables() {
  if (!initPromise) {
    initPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "phone" TEXT;
      `)

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "account_profiles" (
          "id" TEXT PRIMARY KEY,
          "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "name" TEXT NOT NULL,
          "avatar_color" TEXT NOT NULL DEFAULT '#73de90',
          "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      await prisma.$executeRawUnsafe(`
        ALTER TABLE "account_profiles"
        ADD COLUMN IF NOT EXISTS "avatar_color" TEXT NOT NULL DEFAULT '#73de90';
      `)

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "account_profiles_user_id_idx"
        ON "account_profiles" ("user_id");
      `)

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "account_profiles_user_default_idx"
        ON "account_profiles" ("user_id")
        WHERE "is_default" = TRUE;
      `)

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "playback_sessions" (
          "id" TEXT PRIMARY KEY,
          "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "subscription_id" TEXT REFERENCES "subscriptions"("id") ON DELETE CASCADE,
          "profile_id" TEXT NOT NULL REFERENCES "account_profiles"("id") ON DELETE CASCADE,
          "viewer_key" TEXT NOT NULL,
          "channel_uuid" TEXT,
          "channel_name" TEXT,
          "content_type" TEXT,
          "last_event" TEXT,
          "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "playback_sessions_profile_id_idx"
        ON "playback_sessions" ("profile_id");
      `)

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "playback_sessions_user_id_last_seen_idx"
        ON "playback_sessions" ("user_id", "last_seen_at");
      `)

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "watch_progress" (
          "id" TEXT PRIMARY KEY,
          "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "profile_id" TEXT NOT NULL REFERENCES "account_profiles"("id") ON DELETE CASCADE,
          "channel_uuid" TEXT NOT NULL,
          "content_type" TEXT NOT NULL,
          "progress_seconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "duration_seconds" DOUBLE PRECISION,
          "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "completed" BOOLEAN NOT NULL DEFAULT FALSE,
          "is_live" BOOLEAN NOT NULL DEFAULT FALSE,
          "last_watched_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `)

      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "watch_progress_profile_channel_idx"
        ON "watch_progress" ("profile_id", "channel_uuid");
      `)

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "watch_progress_profile_last_watched_idx"
        ON "watch_progress" ("profile_id", "last_watched_at" DESC);
      `)
    })().catch((error) => {
      initPromise = null
      throw error
    })
  }

  return initPromise
}

export async function getActiveSubscription(userId: string): Promise<ActiveSubscription | null> {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          price: true,
          maxDevices: true,
          durationDays: true,
          interval: true,
        },
      },
    },
    orderBy: { expiresAt: 'desc' },
  }) as Promise<ActiveSubscription | null>
}

export async function ensureDefaultProfiles(userId: string, maxProfiles: number) {
  await ensurePlaybackTables()

  const existing = await prisma.$queryRaw<AccountProfileRow[]>`
    SELECT
      "id",
      "user_id" AS "userId",
      "name",
      "avatar_color" AS "avatarColor",
      "is_default" AS "isDefault",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "account_profiles"
    WHERE "user_id" = ${userId}
    ORDER BY "is_default" DESC, "created_at" ASC
  `

  if (existing.length > 0) {
    return existing.slice(0, Math.max(1, maxProfiles))
  }

  const id = randomUUID()
  const avatarColor = getProfileColor(0)
  await prisma.$executeRaw`
    INSERT INTO "account_profiles" ("id", "user_id", "name", "avatar_color", "is_default", "created_at", "updated_at")
    VALUES (${id}, ${userId}, ${'Perfil 1'}, ${avatarColor}, ${true}, NOW(), NOW())
  `

  return prisma.$queryRaw<AccountProfileRow[]>`
    SELECT
      "id",
      "user_id" AS "userId",
      "name",
      "avatar_color" AS "avatarColor",
      "is_default" AS "isDefault",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "account_profiles"
    WHERE "user_id" = ${userId}
    ORDER BY "is_default" DESC, "created_at" ASC
    LIMIT ${Math.max(1, maxProfiles)}
  `
}

export function getViewerKeyFromRequest(request: NextRequest) {
  const cookieKey = request.cookies.get(VIEWER_COOKIE)?.value?.trim()
  if (cookieKey) return cookieKey

  const raw = [
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.headers.get('sec-ch-ua-platform') || '',
  ].join('|')

  return crypto.createHash('sha1').update(raw).digest('hex')
}

export function getSelectedProfileCookie() {
  return cookies().get(PROFILE_COOKIE)?.value || null
}

export async function resolveActiveProfile(userId: string, requestedProfileId: string | null, maxProfiles: number) {
  const profiles = await ensureDefaultProfiles(userId, maxProfiles)
  const selected = profiles.find(profile => profile.id === requestedProfileId)
  return {
    profiles,
    activeProfile: selected || profiles[0] || null,
  }
}

export async function canCreateMoreProfiles(userId: string, maxProfiles: number) {
  const profiles = await ensureDefaultProfiles(userId, maxProfiles)
  return profiles.length < Math.max(1, maxProfiles)
}

export async function createAccountProfile(userId: string, name: string, maxProfiles: number, avatarColor?: string | null) {
  const profiles = await ensureDefaultProfiles(userId, maxProfiles)
  if (profiles.length >= Math.max(1, maxProfiles)) {
    throw new Error('Seu plano atual já atingiu o limite de perfis.')
  }

  const id = randomUUID()
  const resolvedColor = normalizeProfileColor(avatarColor) || getProfileColor(profiles.length)
  await prisma.$executeRaw`
    INSERT INTO "account_profiles" ("id", "user_id", "name", "avatar_color", "is_default", "created_at", "updated_at")
    VALUES (${id}, ${userId}, ${name}, ${resolvedColor}, ${false}, NOW(), NOW())
  `

  return id
}

export async function renameAccountProfile(userId: string, profileId: string, name: string, avatarColor?: string | null) {
  await ensurePlaybackTables()
  const normalizedColor = normalizeProfileColor(avatarColor)
  await prisma.$executeRaw`
    UPDATE "account_profiles"
    SET
      "name" = ${name},
      "avatar_color" = COALESCE(${normalizedColor}, "avatar_color"),
      "updated_at" = NOW()
    WHERE "id" = ${profileId} AND "user_id" = ${userId}
  `
}

export async function deleteAccountProfile(userId: string, profileId: string) {
  await ensurePlaybackTables()
  const profiles = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "account_profiles"
    WHERE "user_id" = ${userId}
    ORDER BY "created_at" ASC
  `

  if (profiles.length <= 1) {
    throw new Error('Você precisa manter pelo menos um perfil.')
  }

  await prisma.$executeRaw`
    DELETE FROM "watch_progress"
    WHERE "profile_id" = ${profileId}
  `
  await prisma.$executeRaw`
    DELETE FROM "playback_sessions"
    WHERE "profile_id" = ${profileId}
  `
  await prisma.$executeRaw`
    DELETE FROM "account_profiles"
    WHERE "id" = ${profileId} AND "user_id" = ${userId}
  `
}

export async function authorizePlaybackAccess(input: {
  userId: string
  subscriptionId: string
  maxDevices: number
  viewerKey: string
  profileId: string
  channelUuid?: string | null
  channelName?: string | null
  contentType?: string | null
  event?: string | null
}) {
  await ensurePlaybackTables()
  const threshold = new Date(Date.now() - SESSION_TTL_SECONDS * 1000)

  await prisma.$executeRaw`
    DELETE FROM "playback_sessions"
    WHERE "last_seen_at" < ${threshold}
  `

  const rows = await prisma.$queryRaw<Array<{
    id: string
    profileId: string
    viewerKey: string
  }>>`
    SELECT
      "id",
      "profile_id" AS "profileId",
      "viewer_key" AS "viewerKey"
    FROM "playback_sessions"
    WHERE "user_id" = ${input.userId}
      AND "last_seen_at" >= ${threshold}
  `

  const currentProfileSession = rows.find(row => row.profileId === input.profileId)
  const activeDistinctProfiles = new Set(rows.map(row => row.profileId))

  if (currentProfileSession && currentProfileSession.viewerKey !== input.viewerKey) {
    return {
      ok: false as const,
      code: 'PROFILE_IN_USE',
      message: 'Este perfil já está em uso em outro dispositivo.',
    }
  }

  if (!currentProfileSession && activeDistinctProfiles.size >= Math.max(1, input.maxDevices)) {
    return {
      ok: false as const,
      code: 'DEVICE_LIMIT',
      message: `Seu plano permite ${input.maxDevices} tela(s) ao mesmo tempo.`,
    }
  }

  if (currentProfileSession) {
    await prisma.$executeRaw`
      UPDATE "playback_sessions"
      SET
        "viewer_key" = ${input.viewerKey},
        "subscription_id" = ${input.subscriptionId},
        "channel_uuid" = ${input.channelUuid || null},
        "channel_name" = ${input.channelName || null},
        "content_type" = ${input.contentType || null},
        "last_event" = ${input.event || null},
        "last_seen_at" = NOW()
      WHERE "id" = ${currentProfileSession.id}
    `
  } else {
    await prisma.$executeRaw`
      INSERT INTO "playback_sessions" (
        "id",
        "user_id",
        "subscription_id",
        "profile_id",
        "viewer_key",
        "channel_uuid",
        "channel_name",
        "content_type",
        "last_event",
        "started_at",
        "last_seen_at"
      )
      VALUES (
        ${randomUUID()},
        ${input.userId},
        ${input.subscriptionId},
        ${input.profileId},
        ${input.viewerKey},
        ${input.channelUuid || null},
        ${input.channelName || null},
        ${input.contentType || null},
        ${input.event || null},
        NOW(),
        NOW()
      )
    `
  }

  return { ok: true as const }
}

export async function releasePlaybackSession(userId: string, profileId: string, viewerKey: string) {
  await ensurePlaybackTables()
  await prisma.$executeRaw`
    DELETE FROM "playback_sessions"
    WHERE "user_id" = ${userId}
      AND "profile_id" = ${profileId}
      AND "viewer_key" = ${viewerKey}
  `
}

export async function saveWatchProgress(input: {
  userId: string
  profileId: string
  channelUuid: string
  contentType: 'LIVE' | 'MOVIE' | 'SERIES'
  progressSeconds: number
  durationSeconds?: number | null
}) {
  await ensurePlaybackTables()

  const isLive = input.contentType === 'LIVE'
  const safeDuration = input.durationSeconds && Number.isFinite(input.durationSeconds) && input.durationSeconds > 0
    ? input.durationSeconds
    : null
  const safeProgress = Math.max(0, Number.isFinite(input.progressSeconds) ? input.progressSeconds : 0)
  const progressPercent = safeDuration ? Math.min(100, (safeProgress / safeDuration) * 100) : 0
  const completed = !isLive && !!safeDuration && progressPercent >= 92

  await prisma.$executeRaw`
    INSERT INTO "watch_progress" (
      "id",
      "user_id",
      "profile_id",
      "channel_uuid",
      "content_type",
      "progress_seconds",
      "duration_seconds",
      "progress_percent",
      "completed",
      "is_live",
      "last_watched_at",
      "created_at",
      "updated_at"
    )
    VALUES (
      ${randomUUID()},
      ${input.userId},
      ${input.profileId},
      ${input.channelUuid},
      ${input.contentType},
      ${safeProgress},
      ${safeDuration},
      ${progressPercent},
      ${completed},
      ${isLive},
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT ("profile_id", "channel_uuid")
    DO UPDATE SET
      "progress_seconds" = EXCLUDED."progress_seconds",
      "duration_seconds" = EXCLUDED."duration_seconds",
      "progress_percent" = EXCLUDED."progress_percent",
      "completed" = EXCLUDED."completed",
      "is_live" = EXCLUDED."is_live",
      "last_watched_at" = NOW(),
      "updated_at" = NOW();
  `
}

export async function getResumeProgress(userId: string, profileId: string, channelUuid: string) {
  await ensurePlaybackTables()
  const rows = await prisma.$queryRaw<Array<{
    progressSeconds: number
    completed: boolean
    contentType: string
  }>>`
    SELECT
      "progress_seconds" AS "progressSeconds",
      "completed",
      "content_type" AS "contentType"
    FROM "watch_progress"
    WHERE "user_id" = ${userId}
      AND "profile_id" = ${profileId}
      AND "channel_uuid" = ${channelUuid}
    LIMIT 1
  `

  const row = rows[0]
  if (!row || row.completed || row.contentType === 'LIVE') return null
  return row.progressSeconds > 15 ? row.progressSeconds : null
}

export async function getContinueWatching(userId: string, profileId: string): Promise<ContinueWatchingItem[]> {
  await ensurePlaybackTables()

  const rows = await prisma.$queryRaw<Array<{
    channelUuid: string
    contentType: 'LIVE' | 'MOVIE' | 'SERIES'
    progressSeconds: number
    durationSeconds: number | null
    progressPercent: number
    isLive: boolean
    lastWatchedAt: Date
  }>>`
    SELECT
      "channel_uuid" AS "channelUuid",
      "content_type" AS "contentType",
      "progress_seconds" AS "progressSeconds",
      "duration_seconds" AS "durationSeconds",
      "progress_percent" AS "progressPercent",
      "is_live" AS "isLive",
      "last_watched_at" AS "lastWatchedAt"
    FROM "watch_progress"
    WHERE "user_id" = ${userId}
      AND "profile_id" = ${profileId}
      AND ("completed" = FALSE OR "is_live" = TRUE)
    ORDER BY "last_watched_at" DESC
    LIMIT 12
  `

  if (rows.length === 0) return []

  const channelMap = new Map(
    (await prisma.channel.findMany({
      where: { uuid: { in: rows.map(row => row.channelUuid) } },
      select: {
        uuid: true,
        name: true,
        logoUrl: true,
        contentType: true,
        episode: {
          select: {
            title: true,
            logoUrl: true,
            season: {
              select: {
                seasonNumber: true,
                series: {
                  select: {
                    title: true,
                    posterUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    })).map(channel => [channel.uuid, channel]),
  )

  return rows
    .map((row) => {
      const channel = channelMap.get(row.channelUuid)
      if (!channel) return null

      if (row.contentType === 'SERIES' && channel.episode?.season?.series) {
        const series = channel.episode.season.series
        return {
          channelUuid: row.channelUuid,
          title: series.title,
          subtitle: channel.episode.title
            ? `Retomar episódio • ${channel.episode.title}`
            : `Retomar episódio`,
          contentType: 'SERIES' as const,
          artworkUrl: series.posterUrl || channel.episode.logoUrl || channel.logoUrl || null,
          progressPercent: row.progressPercent,
          progressSeconds: row.progressSeconds,
          durationSeconds: row.durationSeconds,
          href: `/watch/${row.channelUuid}`,
          lastWatchedAt: row.lastWatchedAt.toISOString(),
          isLive: false,
        }
      }

      return {
        channelUuid: row.channelUuid,
        title: channel.name,
        subtitle: row.isLive ? 'Ao vivo' : row.contentType === 'MOVIE' ? 'Retomar filme' : 'Assistir novamente',
        contentType: row.contentType,
        artworkUrl: channel.logoUrl || null,
        progressPercent: row.isLive ? 0 : row.progressPercent,
        progressSeconds: row.progressSeconds,
        durationSeconds: row.durationSeconds,
        href: `/watch/${row.channelUuid}`,
        lastWatchedAt: row.lastWatchedAt.toISOString(),
        isLive: row.isLive,
      }
    })
    .filter((item): item is ContinueWatchingItem => !!item)
}

export function getProfileCookieName() {
  return PROFILE_COOKIE
}

export function getViewerCookieName() {
  return VIEWER_COOKIE
}

export async function getAdminPlaybackUsage(userIds: string[]): Promise<AdminPlaybackUsageRow[]> {
  await ensurePlaybackTables()

  if (userIds.length === 0) return []

  const threshold = new Date(Date.now() - SESSION_TTL_SECONDS * 1000)

  await prisma.$executeRaw`
    DELETE FROM "playback_sessions"
    WHERE "last_seen_at" < ${threshold}
  `

  const profileCounts = await prisma.$queryRaw<Array<{ userId: string; profilesCount: bigint | number }>>`
    SELECT
      "user_id" AS "userId",
      COUNT(*) AS "profilesCount"
    FROM "account_profiles"
    WHERE "user_id" IN (${Prisma.join(userIds)})
    GROUP BY "user_id"
  `

  const sessionCounts = await prisma.$queryRaw<Array<{ userId: string; activeSessionsCount: bigint | number }>>`
    SELECT
      "user_id" AS "userId",
      COUNT(*) AS "activeSessionsCount"
    FROM "playback_sessions"
    WHERE "user_id" IN (${Prisma.join(userIds)})
      AND "last_seen_at" >= ${threshold}
    GROUP BY "user_id"
  `

  const map = new Map<string, AdminPlaybackUsageRow>()

  for (const userId of userIds) {
    map.set(userId, {
      userId,
      profilesCount: 0,
      activeSessionsCount: 0,
    })
  }

  for (const row of profileCounts) {
    const entry = map.get(row.userId)
    if (entry) {
      entry.profilesCount = Number(row.profilesCount)
    }
  }

  for (const row of sessionCounts) {
    const entry = map.get(row.userId)
    if (entry) {
      entry.activeSessionsCount = Number(row.activeSessionsCount)
    }
  }

  return Array.from(map.values())
}

export async function getAdminPlaybackDetails(userId: string): Promise<AdminPlaybackDetails> {
  await ensurePlaybackTables()

  const threshold = new Date(Date.now() - SESSION_TTL_SECONDS * 1000)

  await prisma.$executeRaw`
    DELETE FROM "playback_sessions"
    WHERE "last_seen_at" < ${threshold}
  `

  const profiles = await prisma.$queryRaw<Array<{
    id: string
    name: string
    avatarColor: string
    isDefault: boolean
    activeSessionCount: bigint | number
  }>>`
    SELECT
      p."id",
      p."name",
      p."avatar_color" AS "avatarColor",
      p."is_default" AS "isDefault",
      COUNT(s."id") AS "activeSessionCount"
    FROM "account_profiles" p
    LEFT JOIN "playback_sessions" s
      ON s."profile_id" = p."id"
      AND s."last_seen_at" >= ${threshold}
    WHERE p."user_id" = ${userId}
    GROUP BY p."id"
    ORDER BY p."is_default" DESC, p."created_at" ASC
  `

  const activeSessions = await prisma.$queryRaw<Array<{
    id: string
    profileId: string
    profileName: string
    avatarColor: string
    channelUuid: string | null
    channelName: string | null
    contentType: string | null
    startedAt: Date
    lastSeenAt: Date
  }>>`
    SELECT
      s."id",
      s."profile_id" AS "profileId",
      p."name" AS "profileName",
      p."avatar_color" AS "avatarColor",
      s."channel_uuid" AS "channelUuid",
      s."channel_name" AS "channelName",
      s."content_type" AS "contentType",
      s."started_at" AS "startedAt",
      s."last_seen_at" AS "lastSeenAt"
    FROM "playback_sessions" s
    INNER JOIN "account_profiles" p
      ON p."id" = s."profile_id"
    WHERE s."user_id" = ${userId}
      AND s."last_seen_at" >= ${threshold}
    ORDER BY s."last_seen_at" DESC
  `

  return {
    profiles: profiles.map(profile => ({
      id: profile.id,
      name: profile.name,
      avatarColor: profile.avatarColor,
      isDefault: profile.isDefault,
      activeSessionCount: Number(profile.activeSessionCount),
    })),
    activeSessions: activeSessions.map(session => ({
      id: session.id,
      profileId: session.profileId,
      profileName: session.profileName,
      avatarColor: session.avatarColor,
      channelUuid: session.channelUuid,
      channelName: session.channelName,
      contentType: session.contentType,
      startedAt: session.startedAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
    })),
  }
}

export async function getUserPlaybackOverview(userId: string, viewerKey: string): Promise<UserPlaybackOverview> {
  await ensurePlaybackTables()

  const threshold = new Date(Date.now() - SESSION_TTL_SECONDS * 1000)

  await prisma.$executeRaw`
    DELETE FROM "playback_sessions"
    WHERE "last_seen_at" < ${threshold}
  `

  const profiles = await prisma.$queryRaw<Array<{
    id: string
    name: string
    avatarColor: string
    isDefault: boolean
    sessionViewerKey: string | null
  }>>`
    SELECT
      p."id",
      p."name",
      p."avatar_color" AS "avatarColor",
      p."is_default" AS "isDefault",
      s."viewer_key" AS "sessionViewerKey"
    FROM "account_profiles" p
    LEFT JOIN "playback_sessions" s
      ON s."profile_id" = p."id"
      AND s."last_seen_at" >= ${threshold}
    WHERE p."user_id" = ${userId}
    ORDER BY p."is_default" DESC, p."created_at" ASC
  `

  const activeSessionsCount = profiles.filter(profile => !!profile.sessionViewerKey).length

  return {
    profiles: profiles.map(profile => {
      const status: UserProfilePlaybackStatus = !profile.sessionViewerKey
        ? 'FREE'
        : profile.sessionViewerKey === viewerKey
          ? 'CURRENT_SCREEN'
          : 'OTHER_SCREEN'

      return {
        id: profile.id,
        name: profile.name,
        avatarColor: profile.avatarColor,
        isDefault: profile.isDefault,
        activeSessionCount: profile.sessionViewerKey ? 1 : 0,
        status,
        statusLabel:
          status === 'CURRENT_SCREEN'
            ? 'Em uso nesta tela'
            : status === 'OTHER_SCREEN'
              ? 'Em uso em outra tela'
              : 'Livre agora',
      }
    }),
    activeSessionsCount,
  }
}

export async function revokePlaybackSession(userId: string, sessionId: string) {
  await ensurePlaybackTables()
  const deletedRows = await prisma.$queryRaw<Array<{ id: string }>>`
    DELETE FROM "playback_sessions"
    WHERE "id" = ${sessionId}
      AND "user_id" = ${userId}
    RETURNING "id"
  `

  return deletedRows[0] || null
}

function getProfileColor(index: number) {
  return PROFILE_COLOR_PALETTE[index % PROFILE_COLOR_PALETTE.length]
}

function normalizeProfileColor(value?: string | null) {
  if (typeof value !== 'string') return null
  const color = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : null
}
