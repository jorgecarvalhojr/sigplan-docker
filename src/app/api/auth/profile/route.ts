export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

// API interna: retorna o role do usuário pelo ID.
// Usada anteriormente pelo middleware e agora para consultas rápidas.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })

    // Verificar que a requisição vem de um usuário autenticado (ou é uma chamada interna válida)
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    // Buscar role diretamente no PostgreSQL Docker
    const [profile] = await sql`
      SELECT role FROM profiles WHERE id = ${userId} LIMIT 1
    `

    return NextResponse.json({ role: profile?.role ?? null })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

