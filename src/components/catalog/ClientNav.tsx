'use client'
import { useState, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { Sun, Moon, LogOut, Search, Menu, X, User, Check } from 'lucide-react'
import { SearchModal } from './SearchModal'
import { cn } from '@/lib/utils'
import { useBranding } from '@/hooks/useBranding'
import { BrandLogo } from '@/components/BrandLogo'

const NAV_LINKS = [
  { href: '/watch',              label: 'Início'   },
  { href: '/watch?cat=filmes',   label: 'Filmes'   },
  { href: '/watch?cat=series',   label: 'Séries'   },
  { href: '/watch?cat=esportes', label: 'Esportes' },
  { href: '/watch?cat=ao-vivo',  label: 'Ao Vivo'  },
]

export function ClientNav({ user }: { user: { name?: string | null; email?: string | null } }) {
  const { data: session } = useSession()
  const branding = useBranding()
  const { resolvedTheme, setTheme } = useTheme()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mounted,    setMounted]    = useState(false)
  const [scrolled,   setScrolled]   = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [profiles, setProfiles] = useState<Array<{
    id: string
    name: string
    avatarColor?: string
    status?: 'FREE' | 'CURRENT_SCREEN' | 'OTHER_SCREEN'
    statusLabel?: string
  }>>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const cookieName = 'viewer_key'
    const hasCookie = document.cookie.split('; ').some(entry => entry.startsWith(`${cookieName}=`))
    if (!hasCookie) {
      const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      document.cookie = `${cookieName}=${key}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    fetch('/api/account/profiles')
      .then(r => (r.ok ? r.json() : { profiles: [] }))
      .then(data => {
        setProfiles(data.profiles || [])
        setActiveProfileId(data.activeProfileId || null)
      })
      .catch(() => {})
  }, [])

  // Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const initial = user.name?.charAt(0).toUpperCase() ?? 'U'
  const activeProfile = profiles.find(profile => profile.id === activeProfileId)

  async function selectProfile(profileId: string) {
    const res = await fetch('/api/account/profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'select', profileId }),
    })
    if (!res.ok) return
    const data = await res.json()
    setProfiles(data.profiles || [])
    setActiveProfileId(profileId)
    setProfileMenuOpen(false)
    window.location.reload()
  }

  return (
    <>
      <header
        className={cn(
          'client-nav-header fixed top-0 inset-x-0 z-50 h-14 transition-all duration-300',
          scrolled ? 'nav-glass shadow-sm' : 'bg-transparent',
        )}
      >
        {/* Gradient for hero area — invisible on scroll */}
        {!scrolled && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        )}

        <div className="relative h-full flex items-center gap-3 px-4 md:px-6 max-w-[1600px] mx-auto">
          {/* Logo */}
          <Link href="/watch" className="flex items-center flex-shrink-0 group">
            <BrandLogo
              alt={branding.siteShortName}
              lightSrc={branding.siteLogoLightUrl}
              darkSrc={branding.siteLogoDarkUrl}
              lightClassName={cn(
                'h-8 md:h-9 transition-all',
                scrolled ? 'opacity-95' : 'brightness-0 invert',
              )}
              darkClassName={cn(
                'h-8 md:h-9 transition-all',
                scrolled ? 'opacity-95' : 'brightness-0 invert',
              )}
            />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-0.5 ml-2">
            {NAV_LINKS.map(l => (
              <Link
                key={l.href} href={l.href}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all',
                  scrolled
                    ? 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    : 'text-white/70 hover:text-white hover:bg-white/10',
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          {profiles.length > 0 && (
            <div className="hidden md:block relative">
              <button
                onClick={() => setProfileMenuOpen(value => !value)}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] transition-all',
                  scrolled
                    ? 'bg-secondary border border-border text-foreground'
                    : 'bg-white/10 border border-white/15 text-white',
                )}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: activeProfile?.avatarColor || '#73de90' }}
                />
                <span>{activeProfile?.name || 'Perfil'}</span>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-background/95 backdrop-blur-xl shadow-xl p-2">
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Perfis da conta
                  </p>
                  {profiles.map(profile => (
                    <button
                      key={profile.id}
                      onClick={() => selectProfile(profile.id)}
                      className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-secondary transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                          style={{ backgroundColor: profile.avatarColor || '#73de90' }}
                        >
                          {profile.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-foreground truncate">{profile.name}</span>
                          <span className="block text-[10px] text-muted-foreground truncate">{profile.statusLabel || 'Livre agora'}</span>
                        </span>
                      </span>
                      {profile.id === activeProfileId && <Check className="w-4 h-4 text-[var(--apple-blue)]" />}
                    </button>
                  ))}
                  <Link
                    href="/profile"
                    className="mt-1 block rounded-xl px-3 py-2.5 text-[12px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Gerenciar perfis
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Search pill */}
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-[13px] transition-all',
              scrolled
                ? 'bg-secondary border border-border text-muted-foreground hover:text-foreground'
                : 'bg-white/10 border border-white/15 text-white/70 hover:text-white hover:bg-white/15',
            )}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden md:block">Buscar</span>
            <kbd className={cn(
              'hidden md:flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-md',
              scrolled ? 'bg-muted text-muted-foreground' : 'bg-white/10 text-white/40',
            )}>
              ⌘K
            </kbd>
          </button>

          {/* Search icon (mobile) */}
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              'sm:hidden w-8 h-8 rounded-lg flex items-center justify-center transition-all',
              scrolled ? 'hover:bg-muted text-muted-foreground' : 'text-white/70 hover:bg-white/10',
            )}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                scrolled ? 'hover:bg-muted text-muted-foreground hover:text-foreground' : 'text-white/70 hover:text-white hover:bg-white/10',
              )}
            >
              {resolvedTheme === 'dark'
                ? <Sun className="w-[15px] h-[15px] text-amber-400" />
                : <Moon className="w-[15px] h-[15px]" />}
            </button>
          )}

          {/* Avatar */}
          <div className={cn(
            'flex items-center gap-1 pl-2 border-l transition-colors',
            scrolled ? 'border-border' : 'border-white/15',
          )}>
            <Link
              href="/profile"
              title="Meu perfil"
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold transition-all hover:scale-105',
                scrolled
                  ? 'bg-[var(--apple-blue)]/15 text-[var(--apple-blue)] border border-[var(--apple-blue)]/20'
                  : 'bg-white/15 text-white border border-white/20',
              )}
            >
              {initial}
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                scrolled ? 'text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-white/50 hover:text-red-400 hover:bg-white/10',
              )}
              title="Sair"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className={cn(
              'lg:hidden w-8 h-8 rounded-lg flex items-center justify-center transition-all ml-1',
              scrolled ? 'hover:bg-muted text-muted-foreground' : 'text-white/70 hover:bg-white/10',
            )}
          >
            {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {menuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)} />
          <div className="client-nav-mobile-drawer lg:hidden fixed top-14 inset-x-0 z-40 nav-glass border-b border-border/50 py-2 px-4 animate-fade-in">
            {NAV_LINKS.map(l => (
              <Link
                key={l.href} href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-3 rounded-xl text-[14px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                {l.label}
              </Link>
            ))}
            <div className="border-t border-border/50 mt-2 pt-2 flex items-center justify-between px-3">
              <Link href="/profile" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground">
                <User className="w-3.5 h-3.5" /> Meu Perfil
              </Link>
              <button onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-[12px] text-red-500 font-medium">
                Sair
              </button>
            </div>
            {profiles.length > 0 && (
              <div className="border-t border-border/50 mt-2 pt-2 px-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-2">
                  Perfil ativo
                </p>
                <div className="space-y-1">
                  {profiles.map(profile => (
                    <button
                      key={profile.id}
                      onClick={() => selectProfile(profile.id)}
                      className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-[13px] text-foreground hover:bg-muted transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shrink-0"
                          style={{ backgroundColor: profile.avatarColor || '#73de90' }}
                        >
                          {profile.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate">{profile.name}</span>
                          <span className="block text-[10px] text-muted-foreground truncate">{profile.statusLabel || 'Livre agora'}</span>
                        </span>
                      </span>
                      {profile.id === activeProfileId && <Check className="w-4 h-4 text-[var(--apple-blue)]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  )
}
