export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const user = session.user

    const body = await req.json()
    const { endpoint, keys } = body

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Dados de inscrição inválidos' }, { status: 400 })
    }

    // Upsert via PostgreSQL Docker
    await sql`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
      VALUES (${user.id}, ${endpoint}, ${keys.p256dh}, ${keys.auth}, NOW())
      ON CONFLICT (endpoint) DO UPDATE SET
        user_id    = EXCLUDED.user_id,
        p256dh     = EXCLUDED.p256dh,
        auth       = EXCLUDED.auth,
        updated_at = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Push Subscribe] Exceção:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

