import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ClientNav } from '@/components/catalog/ClientNav'

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const role = (session.user as any)?.role
  if (role === 'ADMIN') redirect('/admin')
  if (role === 'RESELLER') redirect('/revendedor')

  return (
    <div className="min-h-screen bg-background">
      <ClientNav user={session.user as any} />
      <main className="pt-16">{children}</main>
    </div>
  )
}
