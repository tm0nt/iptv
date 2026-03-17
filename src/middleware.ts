import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC = [
  '/login', '/api/auth', '/api/affiliate',
  '/api/payment/webhook',

  '/_next', '/icons', '/manifest.json', '/sw.js', '/favicon',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.redirect(new URL('/login', request.url))

  const role = token.role as string
  if (pathname.startsWith('/admin')     && role !== 'ADMIN')                    return NextResponse.redirect(new URL('/', request.url))
  if (pathname.startsWith('/revendedor')&& !['ADMIN','RESELLER'].includes(role)) return NextResponse.redirect(new URL('/watch', request.url))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
