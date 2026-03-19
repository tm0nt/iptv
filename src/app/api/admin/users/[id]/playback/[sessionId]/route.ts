import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'
import { revokePlaybackSession } from '@/lib/account-playback'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } },
) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const deleted = await revokePlaybackSession(params.id, params.sessionId)
  if (!deleted) {
    return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })
  }

  const ctx = getAuditRequestContext(request)
  await logAuditEvent({
    action: 'admin.playback.session.revoked',
    entityType: 'PLAYBACK_SESSION',
    entityId: params.sessionId,
    message: `Admin encerrou uma sessão ativa da conta ${params.id}`,
    actor: session.user,
    ...ctx,
    metadata: {
      targetUserId: params.id,
      sessionId: params.sessionId,
    },
  })

  return NextResponse.json({ ok: true })
}
