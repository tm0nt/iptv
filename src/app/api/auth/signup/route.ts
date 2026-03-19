import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '').slice(0, 11)
}

export async function POST(request: NextRequest) {
  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const body = await request.json().catch(() => ({}))

  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const phone = normalizePhone(String(body.phone || ''))
  const password = String(body.password || '')
  const refCode = String(body.refCode || '').trim().toUpperCase()

  if (!name || !email || !phone || !password) {
    return NextResponse.json({ error: 'Preencha nome, email, celular e senha.' }, { status: 400 })
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres.' }, { status: 400 })
  }

  if (phone.length < 10) {
    return NextResponse.json({ error: 'Informe um celular válido com DDD.' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Já existe uma conta com este email.' }, { status: 409 })
  }

  const reseller = refCode
    ? await prisma.user.findFirst({
        where: { referralCode: refCode, role: 'RESELLER', active: true },
        select: { id: true, name: true, referralCode: true },
      })
    : null

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'CLIENT',
      active: true,
      parentId: reseller?.id,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  })

  try {
    await prisma.$executeRaw`
      UPDATE "users"
      SET "phone" = ${phone}
      WHERE "id" = ${user.id}
    `
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2010') {
      throw error
    }

    const rawMessage = typeof error.meta?.message === 'string' ? error.meta.message : ''
    if (!rawMessage.includes('column "phone"')) {
      throw error
    }
  }

  await logAuditEvent({
    action: 'auth.signup.created',
    entityType: 'USER',
    entityId: user.id,
    message: `Nova conta criada para ${user.email}`,
    actor: { id: user.id, email: user.email, role: user.role },
    ipAddress,
    userAgent,
    metadata: {
      referralCode: reseller?.referralCode || null,
      resellerId: reseller?.id || null,
      phone,
    },
  })

  return NextResponse.json({
    user,
    resellerId: reseller?.id || null,
    resellerName: reseller?.name || null,
  }, { status: 201 })
}
