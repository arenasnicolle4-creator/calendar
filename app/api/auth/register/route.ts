// app/api/auth/register/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, makeSessionToken, SERVICE_CATEGORIES } from '@/lib/auth'

const VALID_ROLES = ['manager', 'cleaner', 'provider']
const VALID_CATEGORIES = SERVICE_CATEGORIES.map(c => c.value)

export async function POST(req: Request) {
  try {
    const { email, password, name, role, company, phone, serviceCategory } = await req.json()

    // Validate
    if (!email || !password || !name || !role) {
      return NextResponse.json({ error: 'Email, password, name and role are required' }, { status: 400 })
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (role === 'provider' && !serviceCategory) {
      return NextResponse.json({ error: 'Service category required for providers' }, { status: 400 })
    }
    if (serviceCategory && !VALID_CATEGORIES.includes(serviceCategory)) {
      return NextResponse.json({ error: 'Invalid service category' }, { status: 400 })
    }

    // Check duplicate
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const passwordHash = hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name.trim(),
        role,
        company: company?.trim() || null,
        phone: phone?.trim() || null,
        serviceCategory: role === 'provider' ? serviceCategory : null,
      },
    })

    // Set session cookie
    const token = makeSessionToken(user.id, user.role)
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
    res.cookies.set('cleansync_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })
    // Clear old admin cookie if present
    res.cookies.delete('cleansync_auth')

    return res
  } catch (e) {
    console.error('Register error:', e)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
