'use client'
import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { Eye, EyeOff, Sun, Moon, Tv2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBranding } from '@/hooks/useBranding'
import { BrandLogo } from '@/components/BrandLogo'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const branding = useBranding()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { resolvedTheme, setTheme } = useTheme()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [mounted,  setMounted]  = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      const role = (session?.user as any)?.role
      if (role === 'ADMIN')    router.replace('/admin')
      else if (role === 'RESELLER') router.replace('/revendedor')
      else router.replace('/watch')
    }
  }, [status, session, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) setError('Email ou senha incorretos.')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Subtle background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30vh] right-[-20vw] w-[60vw] h-[60vw] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(circle, #63d995 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20vh] left-[-15vw] w-[40vw] h-[40vw] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle, #3ea66c 0%, transparent 70%)' }} />
      </div>

      {/* Theme toggle */}
      {mounted && (
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="fixed top-5 right-5 w-9 h-9 rounded-full surface flex items-center justify-center hover:bg-muted transition-colors z-10"
        >
          {resolvedTheme === 'dark'
            ? <Sun className="w-4 h-4 text-amber-400" />
            : <Moon className="w-4 h-4 text-muted-foreground" />}
        </button>
      )}

      <div className="relative w-full max-w-[360px] animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {branding.siteLogoUrl ? (
            <div className="mb-3">
              <BrandLogo
                alt={branding.siteShortName}
                lightSrc={branding.siteLogoLightUrl}
                darkSrc={branding.siteLogoDarkUrl}
                lightClassName="h-12"
                darkClassName="h-12"
              />
            </div>
          ) : (
            <div className="w-[60px] h-[60px] rounded-[18px] bg-[var(--apple-blue)] flex items-center justify-center mb-4 shadow-xl shadow-green-500/20">
              <Tv2 className="w-7 h-7 text-white" />
            </div>
          )}
          {!branding.siteLogoUrl && (
            <h1 className="text-[22px] font-semibold text-foreground tracking-tight">{branding.siteName}</h1>
          )}
          <p className="text-[13px] text-muted-foreground mt-0.5">Entre na sua conta</p>
        </div>

        {/* Card */}
        <div className="surface-elevated rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                required
                autoComplete="email"
                className={cn(
                  'field-input rounded-t-xl rounded-b-none border-b-0',
                  error && 'border-red-400/50',
                )}
              />
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Senha"
                  required
                  autoComplete="current-password"
                  className={cn(
                    'field-input rounded-t-none rounded-b-xl pr-11',
                    error && 'border-red-400/50',
                  )}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-[13px] text-red-500 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-[15px] mt-1"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Entrando...</>
                : 'Entrar'}
            </button>
          </form>

          {searchParams.get('ref') && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-center text-[12px] text-muted-foreground">
                Indicado por revendedor ·{' '}
                <span className="text-[var(--apple-blue)] font-medium">{searchParams.get('ref')}</span>
              </p>
            </div>
          )}

          <p className="text-center text-[13px] text-muted-foreground mt-4">
            Ainda nao tem conta?{' '}
            <Link
              href={searchParams.get('ref') ? `/signup?ref=${encodeURIComponent(searchParams.get('ref')!)}` : '/signup'}
              className="text-[var(--apple-blue)] font-medium hover:underline"
            >
              Criar conta
            </Link>
          </p>
        </div>

        <p className="text-center text-[12px] text-muted-foreground mt-6">
          © {new Date().getFullYear()} {branding.siteName}
        </p>
      </div>
    </div>
  )
}
