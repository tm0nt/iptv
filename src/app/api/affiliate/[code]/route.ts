import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const reseller = await prisma.user.findUnique({
    where: { referralCode: params.code },
    select: { id: true, name: true },
  })

  if (!reseller) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Log the click
  await prisma.affiliateClick.create({
    data: {
      resellerId: reseller.id,
      ipAddress: request.headers.get('x-forwarded-for') || request.ip || null,
      userAgent: request.headers.get('user-agent') || null,
    },
  })

  // Redirect to signup with ref code in cookie
  const response = NextResponse.redirect(new URL('/login?ref=' + params.code, request.url))
  response.cookies.set('ref_code', params.code, { maxAge: 60 * 60 * 24 * 7 }) // 7 days
  return response
}
