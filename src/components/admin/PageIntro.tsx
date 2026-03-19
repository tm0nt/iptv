import type { ReactNode } from 'react'

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="surface rounded-[30px] p-6 md:p-7">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground">{title}</h1>
          <div className="text-[14px] text-muted-foreground mt-1">
            {description}
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  )
}
