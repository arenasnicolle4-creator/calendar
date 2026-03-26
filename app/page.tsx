// app/page.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default async function Home() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role === 'manager')  redirect('/dashboard/manager')
  if (user.role === 'cleaner')  redirect('/dashboard/cleaner')
  if (user.role === 'provider') redirect('/dashboard/provider')
  redirect('/dashboard') // legacy admin fallback
}
