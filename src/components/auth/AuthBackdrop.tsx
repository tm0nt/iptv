'use client'

import Image from 'next/image'

export function AuthBackdrop() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/banner.webp"
          alt=""
          fill
          priority
          aria-hidden="true"
          className="object-cover object-[center_center] opacity-34 saturate-[0.92] contrast-[0.96] transition-all duration-500 dark:opacity-26 dark:saturate-[0.95] dark:contrast-[1.02]"
          sizes="100vw"
        />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,250,252,0.56),rgba(244,247,245,0.68))] transition-colors duration-500 dark:bg-[linear-gradient(180deg,rgba(3,7,18,0.56),rgba(3,7,18,0.74))]" />

      <div
        className="absolute inset-0 dark:hidden"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.16) 22%, rgba(255,255,255,0.04) 42%, transparent 62%), radial-gradient(circle at 50% 55%, rgba(115,222,144,0.09) 0%, transparent 45%), linear-gradient(90deg, rgba(15,23,42,0.18) 0%, rgba(15,23,42,0.04) 18%, rgba(15,23,42,0.04) 82%, rgba(15,23,42,0.18) 100%)',
        }}
      />

      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(255,255,255,0.08) 0%, rgba(148,163,184,0.04) 18%, transparent 42%), radial-gradient(circle at 50% 52%, rgba(115,222,144,0.08) 0%, transparent 38%), linear-gradient(90deg, rgba(2,6,23,0.52) 0%, rgba(2,6,23,0.18) 18%, rgba(2,6,23,0.18) 82%, rgba(2,6,23,0.52) 100%), linear-gradient(180deg, rgba(2,6,23,0.24) 0%, rgba(2,6,23,0.08) 26%, rgba(2,6,23,0.42) 100%)',
        }}
      />

      <div className="absolute inset-x-[12%] top-[14%] bottom-[12%] rounded-[3rem] bg-white/8 opacity-60 blur-[110px] dark:bg-emerald-300/[0.03] dark:opacity-80" />
    </div>
  )
}
