// lib/auth.ts
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import * as crypto from 'crypto'

// ── Password hashing (no bcrypt dependency — uses Node built-in crypto) ──

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const attempt = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex')
  return attempt === hash
}

// ── Session token ──

export function makeSessionToken(userId: string, role: string): string {
  const payload = `${userId}:${role}:${Date.now()}`
  const secret = process.env.NEXTAUTH_SECRET || 'cleansync-secret'
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifySessionToken(token: string): { userId: string; role: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8')
    const parts = decoded.split(':')
    if (parts.length < 4) return null
    const [userId, role, ts, sig] = parts
    const payload = `${userId}:${role}:${ts}`
    const secret = process.env.NEXTAUTH_SECRET || 'cleansync-secret'
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    if (sig !== expected) return null
    // Expire after 30 days
    if (Date.now() - parseInt(ts) > 30 * 24 * 60 * 60 * 1000) return null
    return { userId, role }
  } catch {
    return null
  }
}

// ── Get current user from cookie ──

export async function getCurrentUser() {
  const cookieStore = cookies()
  const token = cookieStore.get('cleansync_session')?.value
  if (!token) return null

  const session = verifySessionToken(token)
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      company: true,
      phone: true,
      avatarUrl: true,
      serviceCategory: true,
      isActive: true,
    },
  })

  if (!user || !user.isActive) return null
  return user
}

// ── Role guards ──

export function requireRole(user: { role: string } | null, ...roles: string[]) {
  if (!user) return false
  return roles.includes(user.role)
}

export const ROLES = {
  MANAGER: 'manager',
  CLEANER: 'cleaner',
  PROVIDER: 'provider',
} as const

export type UserRole = typeof ROLES[keyof typeof ROLES]

export const SERVICE_CATEGORIES = [
  { value: 'plumbing',    label: 'Plumber' },
  { value: 'electrical',  label: 'Electrician' },
  { value: 'lawn',        label: 'Lawn Care' },
  { value: 'snow',        label: 'Snow Removal' },
  { value: 'handyman',    label: 'Handyman' },
  { value: 'pest',        label: 'Pest Control' },
  { value: 'hvac',        label: 'HVAC' },
  { value: 'painting',    label: 'Painting' },
  { value: 'roofing',     label: 'Roofing' },
  { value: 'other',       label: 'Other' },
] as const
