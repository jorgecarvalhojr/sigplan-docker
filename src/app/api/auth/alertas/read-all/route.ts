export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export async function POST() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    await sql`
      UPDATE alertas SET lido = true 
      WHERE destinatario_id = ${session.user.id} AND lido = false
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao marcar alertas' }, { status: 500 })
  }
}

