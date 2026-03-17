import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  color?: 'blue' | 'green' | 'violet' | 'amber' | 'red'
}

const colors = {
  blue:   { bg: 'bg-blue-500/10',   icon: 'text-[var(--apple-blue)]' },
  green:  { bg: 'bg-green-500/10',  icon: 'text-[var(--apple-green)]' },
  violet: { bg: 'bg-violet-500/10', icon: 'text-violet-500' },
  amber:  { bg: 'bg-amber-500/10',  icon: 'text-[var(--apple-amber)]' },
  red:    { bg: 'bg-red-500/10',    icon: 'text-[var(--apple-red)]' },
}

export function MetricCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }: MetricCardProps) {
  const c = colors[color]
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-4">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', c.bg)}>
          <Icon className={cn('w-[18px] h-[18px]', c.icon)} />
        </div>
        {trend && (
          <span className={cn(
            'text-[11px] font-semibold px-2 py-1 rounded-full',
            trend.value >= 0
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 text-red-500',
          )}>
            {trend.value >= 0 ? '+' : ''}{trend.value.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground tracking-tight tabular-nums">{value}</p>
      <p className="text-[13px] text-muted-foreground mt-0.5">{title}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{subtitle}</p>}
    </div>
  )
}
