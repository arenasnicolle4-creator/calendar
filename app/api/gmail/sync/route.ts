// app/api/gmail/sync/route.ts
import { NextResponse } from 'next/server'
import { syncGmailAccount, syncAllAccounts } from '@/lib/gmailSync'

// POST /api/gmail/sync         -> sync all accounts
// POST /api/gmail/sync?id=xyz  -> sync one account
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  try {
    if (id) {
      const result = await syncGmailAccount(id)
      return NextResponse.json(result)
    } else {
      const results = await syncAllAccounts()
      return NextResponse.json(results)
    }
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// GET /api/gmail/sync - Vercel cron hits this every 10 minutes
// Configure in vercel.json
export async function GET() {
  try {
    const results = await syncAllAccounts()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalImported = results.reduce((sum, r: any) => sum + (r.imported || 0), 0)
    return NextResponse.json({ ok: true, totalImported, accounts: results })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
