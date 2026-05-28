export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No session' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [profile] = await sql`SELECT * FROM profiles WHERE id = ${session.user.id}`
  const configRows = await sql`SELECT * FROM configuracoes`

  return NextResponse.json({
    session_user: session.user,
    db_profile: profile,
    configs: configRows,
  })
}

