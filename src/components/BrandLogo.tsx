'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

type BrandLogoProps = {
  alt?: string
  darkSrc?: string
  lightSrc?: string
  darkClassName?: string
  lightClassName?: string
}

export function BrandLogo({
  alt = 'Logo',
  darkSrc = '/logo-dark.png',
  lightSrc = '/logo-white.png',
  darkClassName,
  lightClassName,
}: BrandLogoProps) {
  return (
    <>
      <Image
        src={lightSrc}
        alt={alt}
        width={220}
        height={60}
        priority
        unoptimized
        className={cn('h-10 w-auto dark:hidden', lightClassName)}
      />
      <Image
        src={darkSrc}
        alt={alt}
        width={220}
        height={60}
        priority
        unoptimized
        className={cn('hidden h-10 w-auto dark:block', darkClassName)}
      />
    </>
  )
}
