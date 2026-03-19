import { NextResponse } from 'next/server'
import { getPublicSystemConfig } from '@/lib/system-config'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = await getPublicSystemConfig()
  return NextResponse.json(config)
}
