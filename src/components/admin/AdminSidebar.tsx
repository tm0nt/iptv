'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard, Users, CreditCard, Tv, UserCheck,
  Settings, LogOut, Sun, Moon, Menu, X, Tv2, BarChart3,
  Upload, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ADMIN_NAV = [
  { href: '/admin',                       label: 'Visão Geral',     icon: LayoutDashboard, exact: true },
  { href: '/admin/users',                 label: 'Usuários',        icon: Users },
  { href: '/admin/plans',                 label: 'Planos',          icon: CreditCard },
  { href: '/admin/resellers',             label: 'Revendedores',    icon: UserCheck },
  { href: '/admin/channels',              label: 'Canais',          icon: Tv },
  { href: '/admin/channels/categorize',   label: 'Auto-categorizar', icon: Zap },
  { href: '/admin/import',                label: 'Importar M3U',    icon: Upload },
  { href: '/admin/settings',              label: 'Ajustes',         icon: Settings },
]
const RESELLER_NAV = [
  { href: '/revendedor',           label: 'Painel',    icon: LayoutDashboard, exact: true },
  { href: '/revendedor/clientes',  label: 'Clientes',  icon: Users },
  { href: '/revendedor/comissoes', label: 'Comissões', icon: BarChart3 },
]

interface Props { role: string; user: { name?: string | null; email?: string | null } }

export function AdminSidebar({ role, user }: Props) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav   = role === 'ADMIN' ? ADMIN_NAV : RESELLER_NAV
  const title = role === 'ADMIN' ? 'Admin' : 'Revendedor'

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const Sidebar = () => (
    <div className="flex flex-col h-full py-4">
      <div className="px-4 mb-5">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--apple-blue)] flex items-center justify-center shadow-sm">
            <Tv2 className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground leading-none">StreamBox Pro</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{title}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <p className="text-label px-2 mb-2">Menu</p>
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all',
                active
                  ? 'bg-[var(--apple-blue)] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 mt-4 space-y-1 border-t border-border pt-4">
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="btn-ghost w-full justify-start text-[13px]">
          {resolvedTheme === 'dark'
            ? <><Sun className="w-4 h-4 text-amber-400" /> Modo Claro</>
            : <><Moon className="w-4 h-4" /> Modo Escuro</>}
        </button>
        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
            {user.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-muted-foreground hover:text-red-500 transition-colors p-1" title="Sair">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-56 flex-col sidebar z-40">
        <Sidebar />
      </aside>
      <header className="md:hidden fixed top-0 inset-x-0 z-50 h-14 nav-glass px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--apple-blue)] flex items-center justify-center">
            <Tv2 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[14px] font-semibold">{title}</span>
        </div>
        <button onClick={() => setMobileOpen(v => !v)} className="btn-ghost p-2">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed left-0 top-14 bottom-0 w-64 z-50 sidebar border-r border-border animate-fade-in">
            <Sidebar />
          </aside>
        </>
      )}
    </>
  )
}
