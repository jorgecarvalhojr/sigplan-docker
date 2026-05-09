export const dynamic = 'force-dynamic'
/**
 * GET /api/dados/contexto
 * Retorna os dados de contexto compartilhados por todas as páginas do dashboard:
 * - profile do usuário autenticado (com setor)
 * - configuracoes do sistema
 * - lista de setores
 * - lista resumida de usuários ativos (para selects)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    const [profileRows, configRows, setoresRows, usersRows] = await Promise.all([
      sql`
        SELECT p.*, s.codigo AS setor_codigo, s.nome_completo AS setor_nome
        FROM profiles p
        LEFT JOIN setores s ON s.id = p.setor_id
        WHERE p.id = ${user.id}
        LIMIT 1
      `,
      sql`SELECT chave, valor FROM configuracoes ORDER BY chave`,
      sql`SELECT id, codigo, nome_completo FROM setores ORDER BY codigo`,
      sql`
        SELECT p.id, p.nome, p.setor_id, p.role, s.codigo AS setor_codigo
        FROM profiles p
        LEFT JOIN setores s ON s.id = p.setor_id
        WHERE p.role <> 'solicitante' AND p.ativo = true
        ORDER BY p.nome
      `,
    ])

    const profile = profileRows[0] ?? null
    const configuracoes: Record<string, string> = {}
    configRows.forEach((c: any) => { configuracoes[c.chave] = c.valor })

    return NextResponse.json({
      profile: profile ? {
        ...profile,
        setores: profile.setor_id ? { codigo: profile.setor_codigo, nome_completo: profile.setor_nome } : null,
      } : null,
      configuracoes,
      setores: setoresRows,
      usuarios: usersRows.map((u: any) => ({
        id: u.id,
        nome: u.nome,
        setor_id: u.setor_id,
        role: u.role,
        setor_codigo: u.setor_codigo ?? null,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

