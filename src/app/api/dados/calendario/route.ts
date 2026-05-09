export const dynamic = 'force-dynamic'
/**
 * GET /api/dados/calendario
 * Dados para o calendário: projetos com entregas e atividades (datas + status).
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
      SELECT p.*, s.codigo AS setor_codigo, s.nome_completo AS setor_nome
      FROM profiles p LEFT JOIN setores s ON s.id = p.setor_id
      WHERE p.id = ${user.id} LIMIT 1
    `

    const [objetivos, acoes, setores, projetos, configuracoes, solicitacoes, usuarios] = await Promise.all([
      sql`SELECT codigo, nome FROM objetivos_estrategicos ORDER BY codigo`,
      sql`
        SELECT ae.numero, ae.nome, oe.codigo AS oe_codigo
        FROM acoes_estrategicas ae
        LEFT JOIN objetivos_estrategicos oe ON oe.id = ae.objetivo_estrategico_id
        WHERE ae.visivel_enquadramento = true OR ae.visivel_enquadramento IS NULL
        ORDER BY ae.numero
      `,
      sql`SELECT id, codigo, nome_completo FROM setores ORDER BY codigo`,
      sql`
        SELECT p.id, p.nome, p.setor_lider_id, p.status, p.responsavel_id,
               s.codigo AS setor_lider_codigo,
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
                  'responsavel_atividade_id', a.responsavel_atividade_id,
                  'atividade_participantes', (
                    SELECT COALESCE(json_agg(json_build_object(
                      'setor_id', ap.setor_id, 'user_id', ap.user_id,
                      'tipo_participante', ap.tipo_participante
                    )), '[]')
                    FROM atividade_participantes ap WHERE ap.atividade_id = a.id
                  )
                )), '[]')
                FROM atividades a WHERE a.entrega_id = e.id
              )
            ))
            FROM entregas e WHERE e.projeto_id = p.id
          ), '[]') AS entregas
        FROM projetos p
        JOIN setores s ON s.id = p.setor_lider_id
        ORDER BY p.nome
      `,
      sql`SELECT chave, valor FROM configuracoes`,
      sql`SELECT * FROM solicitacoes_alteracao WHERE status = 'em_analise'`,
      sql`
        SELECT p.id, p.nome, p.setor_id, s.codigo AS setor_codigo
        FROM profiles p LEFT JOIN setores s ON s.id = p.setor_id
        WHERE p.role <> 'solicitante' AND p.ativo = true
        ORDER BY p.nome
      `,
    ])

    const cfgMap: Record<string, string> = {}
    configuracoes.forEach((c: any) => { cfgMap[c.chave] = c.valor })

    return NextResponse.json({
      profile: profile ? {
        ...profile,
        setores: profile.setor_id ? { codigo: profile.setor_codigo, nome_completo: profile.setor_nome } : null,
      } : null,
      objetivos, acoes, setores, projetos,
      configuracoes: cfgMap,
      solicitacoes,
      usuarios: usuarios.map((u: any) => ({
        id: u.id, nome: u.nome, setor_id: u.setor_id,
        setores: u.setor_id ? { codigo: u.setor_codigo } : null,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

