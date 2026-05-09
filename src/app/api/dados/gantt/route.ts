export const dynamic = 'force-dynamic'
/**
 * GET /api/dados/gantt
 * Dados para o painel Gantt: projetos com entregas e atividades com datas.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    const [profile] = await sql`
      SELECT p.id, p.role, p.setor_id, s.codigo AS setor_codigo, s.nome_completo AS setor_nome
      FROM profiles p
      LEFT JOIN setores s ON s.id = p.setor_id
      WHERE p.id = ${user.id}
      LIMIT 1
    `

    const [projetos, setores, usuarios] = await Promise.all([
      sql`
        SELECT
          p.id, p.nome, p.descricao, p.setor_lider_id,
          p.tipo_acao, p.responsavel_id, p.status, p.data_inicio,
          s.codigo AS setor_lider_codigo, s.nome_completo AS setor_lider_nome,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', e.id, 'nome', e.nome,
              'data_inicio', e.data_inicio,
              'data_final_prevista', e.data_final_prevista,
              'status', e.status,
              'responsavel_entrega_id', e.responsavel_entrega_id,
              'orgao_responsavel_setor_id', e.orgao_responsavel_setor_id,
              'atividades', (
                SELECT COALESCE(json_agg(json_build_object(
                  'id', a.id, 'nome', a.nome,
                  'data_prevista', a.data_prevista,
                  'status', a.status,
                  'responsavel_atividade_id', a.responsavel_atividade_id
                )), '[]')
                FROM atividades a WHERE a.entrega_id = e.id
              ),
              'entrega_participantes', (
                SELECT COALESCE(json_agg(json_build_object(
                  'setor_id', ep.setor_id, 'tipo_participante', ep.tipo_participante
                )), '[]')
                FROM entrega_participantes ep WHERE ep.entrega_id = e.id
              )
            ))
            FROM entregas e WHERE e.projeto_id = p.id
          ), '[]') AS entregas,
          COALESCE((
            SELECT json_agg(json_build_object('numero', ae.numero, 'nome', ae.nome))
            FROM projeto_acoes pa
            JOIN acoes_estrategicas ae ON ae.id = pa.acao_estrategica_id
            WHERE pa.projeto_id = p.id
          ), '[]') AS acoes
        FROM projetos p
        JOIN setores s ON s.id = p.setor_lider_id
        ORDER BY p.nome
      `,
      sql`SELECT id, codigo, nome_completo FROM setores ORDER BY codigo`,
      sql`
        SELECT p.id, p.nome, p.setor_id, s.codigo AS setor_codigo
        FROM profiles p
        LEFT JOIN setores s ON s.id = p.setor_id
        WHERE p.role <> 'solicitante' AND p.ativo = true
        ORDER BY p.nome
      `,
    ])

    return NextResponse.json({
      profile: profile ? {
        ...profile,
        setores: profile.setor_id
          ? { id: profile.setor_id, codigo: profile.setor_codigo, nome_completo: profile.setor_nome }
          : null,
      } : null,
      projetos,
      setores,
      usuarios: usuarios.map((u: any) => ({
        id: u.id, nome: u.nome, setor_id: u.setor_id,
        setores: u.setor_id ? { codigo: u.setor_codigo } : null,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

