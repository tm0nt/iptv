import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { getAuditAlerts, getAuditHealthSummary, listAuditLogs } from '@/lib/audit'

function escapeCsv(value: unknown) {
  const text = typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value)
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(request: NextRequest) {
  const user = await requireAuth('ADMIN')
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || ''
  const action = searchParams.get('action')?.trim() || ''
  const entityType = searchParams.get('entityType')?.trim() || ''
  const level = searchParams.get('level')?.trim() || ''
  const dateFrom = searchParams.get('dateFrom')?.trim() || ''
  const dateTo = searchParams.get('dateTo')?.trim() || ''
  const format = searchParams.get('format')?.trim() || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const requestedLimit = format === 'csv' ? '5000' : searchParams.get('limit') || '30'
  const limit = Math.min(5000, Math.max(10, parseInt(requestedLimit, 10)))

  const data = await listAuditLogs({ q, action, entityType, level, dateFrom, dateTo, page, limit })
  const [alerts, health] = await Promise.all([getAuditAlerts(), getAuditHealthSummary()])

  if (format === 'csv') {
    const header = ['Data', 'Nivel', 'Acao', 'Entidade', 'ID Entidade', 'Mensagem', 'Ator', 'Perfil', 'IP', 'Metadata']
    const rows = data.logs.map(log => ([
      new Date(log.createdAt).toISOString(),
      log.level,
      log.action,
      log.entityType,
      log.entityId || '',
      log.message,
      log.actorEmail || '',
      log.actorRole || '',
      log.ipAddress || '',
      log.metadata || '',
    ].map(escapeCsv).join(',')))

    return new NextResponse([header.map(escapeCsv).join(','), ...rows].join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="auditoria.csv"',
      },
    })
  }

  return NextResponse.json({ ...data, alerts, health })
}
