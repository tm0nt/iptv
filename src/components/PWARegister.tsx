'use client'
import { useEffect } from 'react'

export function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => console.log('[PWA] Service worker registered'))
        .catch((err) => console.warn('[PWA] SW registration failed:', err))
    }
  }, [])
  return null
}
