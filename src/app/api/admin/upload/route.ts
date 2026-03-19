import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { getAuditRequestContext, logAuditEvent } from '@/lib/audit'

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])

function extFromFile(file: File) {
  const typeMap: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  }

  const fromType = typeMap[file.type]
  if (fromType) return fromType

  const ext = path.extname(file.name || '').toLowerCase()
  return ext || '.png'
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { ipAddress, userAgent } = getAuditRequestContext(request)
  const form = await request.formData()
  const asset = form.get('file')
  const folder = String(form.get('folder') || 'branding').replace(/[^a-z0-9/_-]/gi, '')
  const prefix = String(form.get('prefix') || 'asset').replace(/[^a-z0-9_-]/gi, '')

  if (!(asset instanceof File)) {
    return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.has(asset.type)) {
    return NextResponse.json({ error: 'Tipo de arquivo não suportado' }, { status: 400 })
  }

  if (asset.size > MAX_UPLOAD_SIZE) {
    return NextResponse.json({ error: 'Arquivo excede 10MB' }, { status: 400 })
  }

  const ext = extFromFile(asset)
  const fileName = `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
  const targetDir = path.join(process.cwd(), 'public', 'uploads', folder)
  const targetPath = path.join(targetDir, fileName)
  const publicPath = `/uploads/${folder}/${fileName}`

  await mkdir(targetDir, { recursive: true })
  await writeFile(targetPath, Buffer.from(await asset.arrayBuffer()))

  await logAuditEvent({
    action: 'admin.asset.uploaded',
    entityType: 'ASSET',
    entityId: publicPath,
    message: `Arquivo enviado para ${publicPath}`,
    actor: admin,
    ipAddress,
    userAgent,
    metadata: {
      folder,
      prefix,
      size: asset.size,
      contentType: asset.type,
    },
  })

  return NextResponse.json({ ok: true, path: publicPath })
}
