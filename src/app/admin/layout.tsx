import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'

export const metadata = {
  title: 'Admin Portal',
  description: 'Administrator dashboard',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSuperuser: true },
  })

  if (!user?.isSuperuser) {
    redirect('/')
  }

  return <>{children}</>
}
