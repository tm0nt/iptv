import { NextRequest, NextResponse } from 'next/server'
import { createAuditSnapshot, logAuditEvent, pruneAuditLogs } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const cronHeader = request.headers.get('x-vercel-cron')
  const bearer = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  const authorized =
    cronHeader === '1' ||
    (cronSecret && bearer === `Bearer ${cronSecret}`)

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const snapshot = await createAuditSnapshot()
  const pruned = await pruneAuditLogs()

  await logAuditEvent({
    action: 'system.cron.completed',
    entityType: 'SYSTEM',
    message: 'Cron de auditoria executado com sucesso',
    actor: { role: 'SYSTEM', email: 'cron@system.local' },
    metadata: { snapshot, pruned },
  })

  return NextResponse.json({ ok: true, snapshot, pruned })
}
