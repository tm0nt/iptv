import { NextResponse } from 'next/server'
import { getPublicSystemConfig } from '@/lib/system-config'

export async function GET() {
  const config = await getPublicSystemConfig()
  return NextResponse.json(config)
}

