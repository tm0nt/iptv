import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function ResellerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const role = (session.user as any)?.role
  if (!['ADMIN', 'RESELLER'].includes(role)) redirect('/watch')
  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar role={role} user={session.user as any} />
      <main className="flex-1 ml-0 md:ml-56 min-h-screen overflow-x-hidden">{children}</main>
    </div>
  )
}
