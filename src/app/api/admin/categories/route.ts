import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/m3u-parser'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const cats = await prisma.category.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { channels: { where: { active: true } } } } },
  })
  return NextResponse.json({ categories: cats })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await request.json()
  const slug = slugify(body.name)
  const cat  = await prisma.category.create({
    data: { name: body.name, slug, icon: body.icon || null, order: body.order || 99, active: true },
  })
  const ctx = getAuditRequestContext(request)
  await logAuditEvent({
    action: 'admin.category.created',
    entityType: 'CATEGORY',
    entityId: cat.id,
    message: `Categoria criada: ${cat.name}`,
    actor: session.user,
    ...ctx,
    metadata: { slug: cat.slug, order: cat.order, icon: cat.icon },
  })
  return NextResponse.json({ category: cat }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const category = await prisma.category.findUnique({ where: { id } })
  if (!category) return NextResponse.json({ error: 'Categoria nao encontrada' }, { status: 404 })
  // Unassign channels first
  await prisma.channel.updateMany({ where: { categoryId: id }, data: { categoryId: null } })
  await prisma.category.delete({ where: { id } })
  const ctx = getAuditRequestContext(request)
  await logAuditEvent({
    action: 'admin.category.deleted',
    entityType: 'CATEGORY',
    entityId: id,
    message: `Categoria removida: ${category.name}`,
    actor: session.user,
    ...ctx,
    metadata: { slug: category.slug },
  })
  return NextResponse.json({ success: true })
}
