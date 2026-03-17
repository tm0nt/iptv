'use client'
import { useState, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import { Tv2, Sun, Moon, LogOut, Search, Menu, X, User, Sparkles } from 'lucide-react'
import { SearchModal } from './SearchModal'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/watch',              label: 'Início'   },
  { href: '/watch?cat=filmes',   label: 'Filmes'   },
  { href: '/watch?cat=series',   label: 'Séries'   },
  { href: '/watch?cat=esportes', label: 'Esportes' },
  { href: '/watch?cat=ao-vivo',  label: 'Ao Vivo'  },
]

export function ClientNav({ user }: { user: { name?: string | null; email?: string | null } }) {
  const { data: session } = useSession()
  const { resolvedTheme, setTheme } = useTheme()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mounted,    setMounted]    = useState(false)
  const [scrolled,   setScrolled]   = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
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

  return (
    <>
      <header
        className={cn(
          'fixed top-0 inset-x-0 z-50 h-14 transition-all duration-300',
          scrolled ? 'nav-glass shadow-sm' : 'bg-transparent',
        )}
      >
        {/* Gradient for hero area — invisible on scroll */}
        {!scrolled && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
        )}

        <div className="relative h-full flex items-center gap-3 px-4 md:px-6 max-w-[1600px] mx-auto">
          {/* Logo */}
          <Link href="/watch" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-8 h-8 rounded-[10px] bg-[var(--apple-blue)] flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform">
              <Tv2 className="w-4 h-4 text-white" />
            </div>
            <span
              className={cn(
                'text-[15px] font-bold tracking-tight hidden sm:block transition-colors',
                scrolled ? 'text-foreground' : 'text-white',
              )}
            >
              StreamBox
            </span>
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
          <div className="lg:hidden fixed top-14 inset-x-0 z-40 nav-glass border-b border-border/50 py-2 px-4 animate-fade-in">
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
          </div>
        </>
      )}

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  )
}
