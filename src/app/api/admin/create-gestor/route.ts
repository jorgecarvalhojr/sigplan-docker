import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    const { nome, email, setor_id, role, rg } = await request.json()

    // Validações
    if (!nome || !nome.trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }
    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 })
    }
    if (!setor_id) {
      return NextResponse.json({ error: 'Setor é obrigatório' }, { status: 400 })
    }

    // Verificar permissão do caller (via PostgreSQL Docker)
    const [callerProfile] = await sql`
      SELECT role FROM profiles WHERE id = ${user.id} LIMIT 1
    `
    if (!callerProfile || !['admin', 'master', 'gestor'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const userRole = role === 'usuario' ? 'usuario' : 'gestor'
    const newUserId = crypto.randomUUID()

    // Inserir profile no PostgreSQL Docker
    await sql`
      INSERT INTO profiles (id, email, nome, setor_id, role, rg, senha_zerada)
      VALUES (
        ${newUserId},
        ${email.trim().toLowerCase()},
        ${nome.trim()},
        ${parseInt(setor_id)},
        ${userRole},
        ${rg || null},
        true
      )
    `

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Erro interno' }, { status: 500 })
  }
}
