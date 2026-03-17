'use client'
import { useState, useCallback, createContext, useContext } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Toast { id: string; message: string; type: 'success'|'error'|'info' }
const ToastCtx = createContext<{ toast: (msg: string, type?: Toast['type']) => void } | null>(null)

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be inside Toaster')
  return ctx
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(p => [...p, { id, message, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000)
  }, [])

  return (
    <ToastCtx.Provider value={{ toast }}>
      <div className="fixed bottom-5 right-4 z-[100] space-y-2 max-w-xs">
        {toasts.map(t => (
          <div key={t.id}
            className="flex items-center gap-3 px-4 py-3 surface-elevated rounded-xl text-sm text-foreground animate-fade-in">
            {t.type === 'success' && <CheckCircle className="w-4 h-4 text-[var(--apple-green)] flex-shrink-0" />}
            {t.type === 'error'   && <AlertCircle  className="w-4 h-4 text-[var(--apple-red)]   flex-shrink-0" />}
            {t.type === 'info'    && <Info          className="w-4 h-4 text-[var(--apple-blue)]  flex-shrink-0" />}
            <span className="flex-1 text-[13px]">{t.message}</span>
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}
              className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
