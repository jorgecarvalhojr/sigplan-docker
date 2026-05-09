export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const user = session.user

    // Verificar perfil via PostgreSQL Docker
    const [profile] = await sql`
      SELECT role, ativo FROM profiles WHERE id = ${user.id} LIMIT 1
    `
    if (!profile || !profile.ativo || profile.role === 'solicitante') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const path = typeof body?.path === 'string' ? body.path : null
    if (!path || !/^(entregas|atividades)\/\d+\/[a-f0-9-]+\.pdf$/i.test(path)) {
      return NextResponse.json({ error: 'path inválido' }, { status: 400 })
    }

    const { deleteResultadoPDF } = await import('@/lib/resultados-storage')
    await deleteResultadoPDF(path)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'

