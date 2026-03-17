import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { VideoPlayer } from '@/components/player/VideoPlayer'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, Tv2 } from 'lucide-react'

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

  return (
    <div className="min-h-screen bg-background">
      <div className="md:hidden sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-2.5">
        <Link href="/watch" className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" /> Catálogo
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-0 md:px-6 py-0 md:py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Player */}
          <div className="flex-1 min-w-0">
            <VideoPlayer channelUuid={channel.uuid} channelName={channel.name} logoUrl={channel.logoUrl} />

            <div className="px-4 md:px-0 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary border border-border overflow-hidden relative flex-shrink-0">
                    {channel.logoUrl
                      ? <Image src={channel.logoUrl} alt="" fill className="object-contain p-1.5" unoptimized />
                      : <Tv2 className="w-4 h-4 text-muted-foreground m-auto mt-3" />
                    }
                  </div>
                  <div>
                    <h1 className="text-[16px] font-semibold text-foreground">{channel.name}</h1>
                    {channel.category ? (
                      <Link href={`/watch?cat=${encodeURIComponent(channel.category.name)}`}
                        className="text-[12px] text-[var(--apple-blue)] hover:underline">
                        {channel.category.name}
                      </Link>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">
                        {channel.groupTitle || 'Sem categoria'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">Ao Vivo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar — related channels */}
          {deduped.length > 0 && (
            <aside className="lg:w-72 xl:w-80 flex-shrink-0">
              <p className="hidden lg:block text-[13px] font-semibold text-foreground mb-3">Canais relacionados</p>
              <div className="hidden lg:flex flex-col gap-1">
                {deduped.map(ch => (
                  <Link key={ch.uuid} href={`/watch/${ch.uuid}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary transition-colors group">
                    <div className="w-9 h-9 rounded-lg bg-secondary border border-border overflow-hidden relative flex-shrink-0">
                      {ch.logoUrl
                        ? <Image src={ch.logoUrl} alt="" fill className="object-contain p-1.5" unoptimized />
                        : <Tv2 className="w-3.5 h-3.5 text-muted-foreground m-auto mt-2.5" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground line-clamp-1 group-hover:text-[var(--apple-blue)] transition-colors">
                        {ch.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{ch.category?.name || 'Sem categoria'}</p>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="lg:hidden px-4 md:px-0">
                <p className="text-[13px] font-semibold text-foreground mb-2.5">Canais relacionados</p>
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {deduped.slice(0, 10).map(ch => (
                    <Link key={ch.uuid} href={`/watch/${ch.uuid}`}
                      className="flex-none w-20 surface rounded-xl p-2 flex flex-col items-center gap-1.5 active:scale-95">
                      <div className="w-full h-10 relative bg-secondary rounded-lg overflow-hidden">
                        {ch.logoUrl
                          ? <Image src={ch.logoUrl} alt="" fill className="object-contain p-1" unoptimized />
                          : <Tv2 className="w-3 h-3 text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        }
                      </div>
                      <p className="text-[10px] font-medium text-foreground text-center line-clamp-1 w-full">{ch.name}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
