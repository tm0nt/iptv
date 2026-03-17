import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { UserRole } from '@/types'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.active) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return {
          id:           user.id,
          email:        user.email,
          name:         user.name,
          role:         user.role as UserRole,
          referralCode: user.referralCode,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id           = user.id
        token.role         = (user as any).role as UserRole
        token.referralCode = (user as any).referralCode as string | null
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id           = token.id
        session.user.role         = token.role as UserRole
        session.user.referralCode = token.referralCode
      }
      return session
    },
  },
}
