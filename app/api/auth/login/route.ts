// app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const { username, password } = await req.json()

  const adminUser = process.env.ADMIN_USERNAME || 'admin'
  const adminPass = process.env.ADMIN_PASSWORD || 'cleansync'

  if (username === adminUser && password === adminPass) {
    const cookieStore = cookies()
    cookieStore.set('cleansync_auth', process.env.NEXTAUTH_SECRET || 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
}

export async function DELETE() {
  const cookieStore = cookies()
  cookieStore.delete('cleansync_auth')
  return NextResponse.json({ ok: true })
}
