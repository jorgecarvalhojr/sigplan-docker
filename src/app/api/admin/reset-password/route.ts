import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    // Verificar permissão via PostgreSQL Docker
    const [callerProfile] = await sql`
      SELECT role FROM profiles WHERE id = ${user.id} LIMIT 1
    `
    if (!callerProfile || !['admin', 'master'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })

    // Marcar profile como senha zerada no PostgreSQL Docker
    await sql`
      UPDATE profiles
      SET senha_zerada = true
      WHERE id = ${userId}
    `

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
