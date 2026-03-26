// app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, makeSessionToken } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // ── Legacy admin fallback (env-based, for your existing setup) ──
    const adminUser = process.env.ADMIN_USERNAME
    const adminPass = process.env.ADMIN_PASSWORD
    if (adminUser && adminPass && email === adminUser && password === adminPass) {
      const secret = process.env.NEXTAUTH_SECRET || 'authenticated'
      const res = NextResponse.json({ ok: true, role: 'admin', legacy: true })
      res.cookies.set('cleansync_auth', secret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      })
      return res
    }

    // ── New user auth ──
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const valid = verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const token = makeSessionToken(user.id, user.role)

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
    res.cookies.set('cleansync_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    return res
  } catch (e) {
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
