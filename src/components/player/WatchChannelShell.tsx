'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, Tv2 } from 'lucide-react'
import { VideoPlayer } from '@/components/player/VideoPlayer'
import { cn } from '@/lib/utils'

interface ChannelDetails {
  uuid: string
  name: string
  contentType?: 'LIVE' | 'MOVIE' | 'SERIES' | 'RADIO'
  logoUrl?: string | null
  groupTitle?: string | null
  category?: { name: string } | null
}

interface RelatedChannel {
  uuid: string
  name: string
  logoUrl?: string | null
  category?: { name: string } | null
}

interface WatchChannelShellProps {
  channel: ChannelDetails
  related: RelatedChannel[]
}

export function WatchChannelShell({ channel, related }: WatchChannelShellProps) {
  const [stackRelatedBelow, setStackRelatedBelow] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <div className="watch-subheader md:hidden sticky top-14 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-2.5">
        <Link href="/watch" className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" /> Catalogo
        </Link>
      </div>

      <div className={cn(
        'mx-auto px-0 md:px-6 py-0 md:py-6 transition-all duration-300',
        stackRelatedBelow ? 'max-w-[1500px]' : 'max-w-7xl',
      )}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className={cn(
            'min-w-0 lg:col-span-8 xl:col-span-9 transition-all duration-300',
            stackRelatedBelow && 'lg:col-span-12 xl:col-span-12',
          )}>
            <div className={cn(
              'w-full transition-all duration-300',
              stackRelatedBelow && 'mx-auto',
            )}>
              <VideoPlayer
                channelUuid={channel.uuid}
                channelName={channel.name}
                contentType={channel.contentType as any}
                logoUrl={channel.logoUrl}
                layoutExpanded={stackRelatedBelow}
                onToggleLayout={() => setStackRelatedBelow(value => !value)}
              />

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
                        <Link
                          href={`/watch?cat=${encodeURIComponent(channel.category.name)}`}
                          className="text-[12px] text-[var(--apple-blue)] hover:underline"
                        >
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
          </div>

          {related.length > 0 && (
            <aside className={cn(
              'lg:col-span-4 xl:col-span-3 transition-all duration-300',
              stackRelatedBelow && 'lg:col-span-12 xl:col-span-12',
            )}>
              <div className="w-full">
                <p className="hidden lg:block text-[13px] font-semibold text-foreground mb-3">
                  {stackRelatedBelow ? 'Canais relacionados' : 'Canais relacionados'}
                </p>

                {!stackRelatedBelow && (
                  <div className="hidden lg:flex flex-col gap-1">
                    {related.map(ch => (
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
                )}

                {stackRelatedBelow && (
                  <div className="hidden lg:grid grid-cols-2 xl:grid-cols-4 gap-3">
                    {related.map(ch => (
                      <Link
                        key={ch.uuid}
                        href={`/watch/${ch.uuid}`}
                        className="surface rounded-2xl p-3 flex items-center gap-3 hover:-translate-y-0.5 transition-transform"
                      >
                        <div className="w-11 h-11 rounded-xl bg-secondary border border-border overflow-hidden relative flex-shrink-0">
                          {ch.logoUrl
                            ? <Image src={ch.logoUrl} alt="" fill className="object-contain p-1.5" unoptimized />
                            : <Tv2 className="w-4 h-4 text-muted-foreground m-auto mt-3" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-foreground line-clamp-1">{ch.name}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{ch.category?.name || 'Sem categoria'}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="lg:hidden px-4 md:px-0">
                  <p className="text-[13px] font-semibold text-foreground mb-2.5">Canais relacionados</p>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {related.slice(0, 10).map(ch => (
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
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}
