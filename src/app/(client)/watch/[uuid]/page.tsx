import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { WatchChannelShell } from '@/components/player/WatchChannelShell'

interface Props { params: { uuid: string } }

export default async function WatchChannelPage({ params }: Props) {
  const channel = await prisma.channel.findUnique({
    where: { uuid: params.uuid, active: true },
    include: { category: { select: { id: true, name: true } } },
  })
  if (!channel) notFound()

  // Smart related: same category (if any) + same name prefix
  const namePrefix = channel.name.replace(/\s*\d+$/, '').replace(/\s*(HD|FHD|SD|4K)$/i, '').trim()

  const relatedWhere: any = {
    active: true,
    uuid:   { not: channel.uuid },
    OR: [] as any[],
  }
  if (channel.categoryId)    relatedWhere.OR.push({ categoryId: channel.categoryId })
  if (namePrefix.length > 3) relatedWhere.OR.push({ name: { startsWith: namePrefix, mode: 'insensitive' } })
  if (!relatedWhere.OR.length) delete relatedWhere.OR

  const related = await prisma.channel.findMany({
    where: relatedWhere,
    select: { uuid: true, name: true, logoUrl: true, category: { select: { name: true } } },
    orderBy: { viewCount: 'desc' },
    take: 16,
  })

  const seen  = new Set<string>()
  const deduped = related.filter(r => { if (seen.has(r.uuid)) return false; seen.add(r.uuid); return true })

  return <WatchChannelShell channel={channel} related={deduped} />
}
