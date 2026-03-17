import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function RootPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const role = (session.user as any)?.role
  if (role === 'ADMIN') redirect('/admin')
  if (role === 'RESELLER') redirect('/revendedor')
  redirect('/watch')
}
