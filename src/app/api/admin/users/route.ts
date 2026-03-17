import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function checkAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.role === 'ADMIN' ? session : null
}

export async function GET(request: NextRequest) {
  const session = await checkAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const where = role ? { role: role as any } : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true,
        active: true, createdAt: true, referralCode: true, commissionRate: true,
        _count: { select: { subscriptions: true, clientsAsReseller: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  return NextResponse.json({ users, total, page, limit })
}

export async function POST(request: NextRequest) {
  const session = await checkAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const hashed = await bcrypt.hash(body.password, 12)

  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      password: hashed,
      role: body.role || 'CLIENT',
      active: true,
      referralCode: body.role === 'RESELLER' ? generateCode(body.name) : undefined,
      commissionRate: body.role === 'RESELLER' ? (body.commissionRate || 0.20) : undefined,
      parentId: body.role === 'RESELLER' ? (session.user as any).id : undefined,
    },
  })

  return NextResponse.json({ user: { ...user, password: undefined } }, { status: 201 })
}

export async function PUT(request: NextRequest) {
  const session = await checkAdmin()
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const data: any = {
    name: body.name,
    active: body.active,
    commissionRate: body.commissionRate,
  }

  if (body.password) {
    data.password = await bcrypt.hash(body.password, 12)
  }

  const user = await prisma.user.update({ where: { id: body.id }, data })
  return NextResponse.json({ user: { ...user, password: undefined } })
}

function generateCode(name: string): string {
  const clean = name.toUpperCase().replace(/\s+/g, '').slice(0, 6)
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `${clean}${suffix}`
}
