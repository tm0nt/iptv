'use client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Play, Info } from 'lucide-react'
import type { ChannelItem } from '@/components/catalog/CatalogCarousel'

export function HeroBanner({ channel, category }: { channel: ChannelItem; category: string }) {
  const router = useRouter()

  return (
    <div className="relative w-full h-[46vh] md:h-[56vh] bg-[var(--apple-gray-6)] dark:bg-[#0a0a0a] overflow-hidden">
      {channel.logoUrl && (
        <div className="absolute inset-0 scale-110 overflow-hidden">
          <Image src={channel.logoUrl} alt="" fill
            className="object-cover blur-3xl opacity-20 dark:opacity-15 scale-110" unoptimized />
        </div>
      )}

      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, hsl(var(--background)) 0%, hsl(var(--background)/0.85) 45%, transparent 100%)' }} />
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(0deg, hsl(var(--background)) 0%, hsl(var(--background)/0.5) 35%, transparent 100%)' }} />

      <div className="absolute bottom-0 left-0 px-4 md:px-6 pb-8 md:pb-10 max-w-lg">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center gap-1.5 badge badge-red text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--apple-red)] animate-pulse" />
            AO VIVO
          </span>
          <span className="badge badge-blue text-[10px]">{category}</span>
        </div>

        <h1 className="text-[28px] md:text-[40px] font-bold text-foreground tracking-tight leading-tight mb-2">
          {channel.name}
        </h1>
        <p className="text-[13px] text-muted-foreground mb-5">
          Transmissão ao vivo · Full HD · StreamBox Pro
        </p>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push(`/watch/${channel.uuid}`)}
            className="btn-primary px-5 py-2.5 text-[14px] shadow-lg shadow-blue-500/20"
          >
            <Play className="w-4 h-4 fill-white" />
            Assistir agora
          </button>
          <button className="btn-secondary px-5 py-2.5 text-[14px]">
            <Info className="w-4 h-4" />
            Detalhes
          </button>
        </div>
      </div>

      {channel.logoUrl && (
        <div className="hidden sm:block absolute right-8 md:right-12 top-1/2 -translate-y-1/2 w-32 h-32 md:w-44 md:h-44 opacity-[0.45]">
          <Image src={channel.logoUrl} alt={channel.name} fill
            className="object-contain drop-shadow-2xl" unoptimized />
        </div>
      )}
    </div>
  )
}
