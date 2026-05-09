/**
 * GET /api/dados/perfil  — dados do perfil com setor
 * PATCH /api/dados/perfil — atualiza nome e/ou senha_zerada do profile
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const [profile] = await sql`
      SELECT p.*, s.codigo AS setor_codigo, s.nome_completo AS setor_nome
      FROM profiles p
      LEFT JOIN setores s ON s.id = p.setor_id
      WHERE p.id = ${session.user.id}
      LIMIT 1
    `
    if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

    return NextResponse.json({
      ...profile,
      setores: profile.setor_id
        ? { codigo: profile.setor_codigo, nome_completo: profile.setor_nome }
        : null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = await request.json()

    // Campos permitidos pelo próprio usuário
    if (body.nome !== undefined) {
      const nome = String(body.nome).trim()
      if (!nome) return NextResponse.json({ error: 'Nome inválido' }, { status: 400 })
      await sql`UPDATE profiles SET nome = ${nome} WHERE id = ${session.user.id}`
    }

    if (body.senha_zerada !== undefined) {
      await sql`
        UPDATE profiles SET senha_zerada = ${Boolean(body.senha_zerada)}
        WHERE id = ${session.user.id}
      `
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
