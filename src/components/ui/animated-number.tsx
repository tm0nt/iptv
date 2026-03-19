'use client'

import { useEffect, useRef, useState } from 'react'

export function AnimatedNumber({
  value,
  formatter = (next) => next.toLocaleString('pt-BR'),
  duration = 650,
}: {
  value: number
  formatter?: (value: number) => string
  duration?: number
}) {
  const previous = useRef(value)
  const [displayValue, setDisplayValue] = useState(value)

  useEffect(() => {
    const from = previous.current
    const to = value

    if (from === to) return

    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(from + (to - from) * eased)

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        previous.current = to
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span>{formatter(displayValue)}</span>
}
