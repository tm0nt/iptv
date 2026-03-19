import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'

async function getSession() {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  return { session, role }
}

export async function GET() {
  const { session, role } = await getSession()
  // Resellers can READ plans (to create clients), only Admin can write
  if (!session || !role || !['ADMIN', 'RESELLER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const plans = await prisma.plan.findMany({
    where: role === 'RESELLER' ? { active: true } : {},
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { price: 'asc' },
  })

  return NextResponse.json({ plans })
}

export async function POST(request: NextRequest) {
  const { session, role } = await getSession()
  if (!session || role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const body = await request.json()
  const plan = await prisma.plan.create({
    data: {
      name: body.name,
      description: body.description,
      price: parseFloat(body.price),
      interval: body.interval,
      durationDays: parseInt(body.durationDays),
      maxDevices: parseInt(body.maxDevices) || 1,
      active: body.active ?? true,
      featured: body.featured ?? false,
    },
  })

  await logAuditEvent({
    action: 'admin.plan.created',
    entityType: 'PLAN',
    entityId: plan.id,
    message: `Plano ${plan.name} criado`,
    actor: session.user,
    ipAddress,
    userAgent,
    metadata: { price: plan.price, interval: plan.interval, active: plan.active },
  })

  return NextResponse.json({ plan }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const { session, role } = await getSession()
  if (!session || role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const body = await request.json()
  const plan = await prisma.plan.update({
    where: { id: body.id },
    data: {
      name: body.name,
      description: body.description,
      price: parseFloat(body.price),
      interval: body.interval,
      durationDays: parseInt(body.durationDays),
      maxDevices: parseInt(body.maxDevices),
      active: body.active,
      featured: body.featured,
    },
  })

  await logAuditEvent({
    action: 'admin.plan.updated',
    entityType: 'PLAN',
    entityId: plan.id,
    message: `Plano ${plan.name} atualizado`,
    actor: session.user,
    ipAddress,
    userAgent,
    metadata: { price: plan.price, interval: plan.interval, active: plan.active, featured: plan.featured },
  })

  return NextResponse.json({ plan })
}

export async function DELETE(request: NextRequest) {
  const { session, role } = await getSession()
  if (!session || role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const plan = await prisma.plan.update({ where: { id }, data: { active: false } })

  await logAuditEvent({
    action: 'admin.plan.deactivated',
    entityType: 'PLAN',
    entityId: plan.id,
    message: `Plano ${plan.name} desativado`,
    actor: session.user,
    ipAddress,
    userAgent,
    metadata: { price: plan.price, interval: plan.interval },
  })

  return NextResponse.json({ success: true })
}
