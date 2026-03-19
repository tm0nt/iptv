import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { requireAdmin } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const search    = searchParams.get('q')       ?? ''
  const uuid      = searchParams.get('uuid')    ?? ''
  const catFilter = searchParams.get('cat')     ?? ''
  const page      = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit     = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '100')))

  const where: Prisma.ChannelWhereInput = { active: true }

  if (uuid) where.uuid = uuid

  if (!uuid && search.trim()) {
    where.OR = [
      { name:       { contains: search.trim(), mode: 'insensitive' } },
      { tvgName:    { contains: search.trim(), mode: 'insensitive' } },
      { groupTitle: { contains: search.trim(), mode: 'insensitive' } },
    ]
  }
  if (catFilter === 'none') where.categoryId = null
  else if (catFilter)       where.categoryId = catFilter

  const [channels, total, categories] = await Promise.all([
    prisma.channel.findMany({
      where,
      select: {
        uuid: true, name: true, logoUrl: true, active: true,
        isFeatured: true, viewCount: true, groupTitle: true, categoryId: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.channel.count({ where }),
    prisma.category.findMany({
      where: { active: true }, orderBy: { order: 'asc' },
      select: { id: true, name: true, slug: true, icon: true,
        _count: { select: { channels: { where: { active: true } } } } },
    }),
  ])

  return NextResponse.json({ channels, total, categories, page, limit })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const body = await request.json() as Record<string, unknown>

  if (Array.isArray(body.uuids)) {
    const result = await prisma.channel.updateMany({
      where: { uuid: { in: body.uuids as string[] } },
      data:  { categoryId: (body.categoryId as string | null) ?? null },
    })

    await logAuditEvent({
      action: 'admin.channels.bulk_updated',
      entityType: 'CHANNEL',
      message: `${result.count} canais atualizados em massa`,
      actor: admin,
      ipAddress,
      userAgent,
      metadata: {
        uuids: body.uuids,
        categoryId: (body.categoryId as string | null) ?? null,
      },
    })

    return NextResponse.json({ updated: result.count })
  }

  const data: Partial<{ active: boolean; isFeatured: boolean; categoryId: string | null }> = {}
  if (typeof body.active     === 'boolean') data.active     = body.active
  if (typeof body.isFeatured === 'boolean') data.isFeatured = body.isFeatured
  if ('categoryId' in body)                 data.categoryId = (body.categoryId as string | null)

  const ch = await prisma.channel.update({
    where: { uuid: body.uuid as string }, data,
    select: { uuid: true, active: true, isFeatured: true, categoryId: true },
  })

  await logAuditEvent({
    action: 'admin.channel.updated',
    entityType: 'CHANNEL',
    entityId: ch.uuid,
    message: `Canal ${ch.uuid} atualizado`,
    actor: admin,
    ipAddress,
    userAgent,
    metadata: data,
  })

  return NextResponse.json({ channel: ch })
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const uuid = new URL(request.url).searchParams.get('uuid')
  if (!uuid) return NextResponse.json({ error: 'uuid required' }, { status: 400 })

  const { ipAddress, userAgent } = getAuditRequestContext(request)
  await prisma.channel.update({ where: { uuid }, data: { active: false } })

  await logAuditEvent({
    action: 'admin.channel.deactivated',
    entityType: 'CHANNEL',
    entityId: uuid,
    message: `Canal ${uuid} desativado`,
    actor: admin,
    ipAddress,
    userAgent,
  })

  return NextResponse.json({ success: true })
}
