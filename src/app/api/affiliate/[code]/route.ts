import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'

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
  const { ipAddress, userAgent } = getAuditRequestContext(request)
  await prisma.affiliateClick.create({
    data: {
      resellerId: reseller.id,
      ipAddress,
      userAgent,
    },
  })

  await logAuditEvent({
    action: 'affiliate.link.clicked',
    entityType: 'AFFILIATE',
    entityId: params.code,
    message: `Link de afiliado ${params.code} recebeu um clique`,
    actor: { id: reseller.id, role: 'RESELLER' },
    ipAddress,
    userAgent,
    metadata: { referralCode: params.code, resellerName: reseller.name },
  })

  // Redirect to signup with ref code in cookie
  const response = NextResponse.redirect(new URL('/signup?ref=' + params.code, request.url))
  response.cookies.set('ref_code', params.code, { maxAge: 60 * 60 * 24 * 7 }) // 7 days
  return response
}
