import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type SkeletonProps = HTMLAttributes<HTMLDivElement>

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden className={cn('skeleton rounded-xl', className)} {...props} />
}

export function TableSkeleton({
  columns = 5,
  rows = 5,
}: {
  columns?: number
  rows?: number
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full data-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index}>
                <Skeleton className="h-3 w-20 rounded-full" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, columnIndex) => (
                <td key={columnIndex}>
                  <Skeleton className="h-4 w-full max-w-[140px] rounded-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
