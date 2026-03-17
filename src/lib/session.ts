import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import type { UserRole } from '@/types'

export interface AuthUser {
  id:            string
  email:         string
  name:          string
  role:          UserRole
  referralCode?: string | null
}

export async function requireAuth(minRole?: UserRole): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null

  const user = session.user as AuthUser

  if (minRole) {
    const LEVELS: Record<UserRole, number> = { CLIENT: 1, RESELLER: 2, ADMIN: 3 }
    if ((LEVELS[user.role] ?? 0) < LEVELS[minRole]) return null
  }

  return user
}

export async function requireAdmin(): Promise<AuthUser | null> {
  return requireAuth('ADMIN')
}
