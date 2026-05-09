/**
 * GET /api/dados/relatorios
 * Dados consolidados para a página de relatórios.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.log('[API Relatorios] GET request received')
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const [profile] = await sql`
      SELECT p.*, s.codigo AS setor_codigo
      FROM profiles p LEFT JOIN setores s ON s.id = p.setor_id
      WHERE p.id = ${session.user.id} LIMIT 1
    `
    if (!profile || profile.role === 'solicitante') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    console.log('[API Relatorios] Fetching objetivos...')
    const objetivos = await sql`SELECT codigo, nome FROM objetivos_estrategicos ORDER BY codigo`
    
    console.log('[API Relatorios] Fetching acoes...')
    const acoes = await sql`
        SELECT ae.id, ae.numero, ae.nome, ae.descricao_o_que,
               oe.codigo AS oe_codigo
        FROM acoes_estrategicas ae
        LEFT JOIN objetivos_estrategicos oe ON oe.id = ae.objetivo_estrategico_id
        WHERE ae.visivel_enquadramento = true OR ae.visivel_enquadramento IS NULL
        ORDER BY ae.numero
      `
    
    console.log('[API Relatorios] Fetching setores...')
    const setores = await sql`SELECT id, codigo, nome_completo FROM setores ORDER BY codigo`
    
    console.log('[API Relatorios] Fetching profiles...')
    const profiles = await sql`
        SELECT p.id, p.nome, p.role, p.setor_id, p.ativo, s.codigo AS setor_codigo
        FROM profiles p
        LEFT JOIN setores s ON s.id = p.setor_id
        WHERE p.role <> 'solicitante'
        ORDER BY p.nome
      `
    
    console.log('[API Relatorios] Fetching projetos...')
    const projetos = await sql`
        SELECT p.id, p.nome, p.descricao, p.setor_lider_id, p.tipo_acao,
               p.responsavel_id, p.status, s.codigo AS setor_lider_codigo,
               s.nome_completo AS setor_lider_nome,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', e.id, 'nome', e.nome, 'status', e.status,
              'data_final_prevista', e.data_final_prevista,
              'responsavel_entrega_id', e.responsavel_entrega_id,
              'orgao_responsavel_setor_id', e.orgao_responsavel_setor_id,
              'atividades', COALESCE((
                SELECT json_agg(json_build_object(
                  'id', a.id, 'nome', a.nome, 'status', a.status,
                  'responsavel_atividade_id', a.responsavel_atividade_id,
                  'atividade_participantes', COALESCE((
                    SELECT json_agg(json_build_object(
                      'user_id', ap.user_id, 'setor_id', ap.setor_id,
                      'tipo_participante', ap.tipo_participante,
                      'setor_codigo', s2.codigo
                    ))
                    FROM atividade_participantes ap
                    LEFT JOIN setores s2 ON s2.id = ap.setor_id
                    WHERE ap.atividade_id = a.id
                  ), '[]'::json)
                ))
                FROM atividades a WHERE a.entrega_id = e.id
              ), '[]'::json)
            ))
            FROM entregas e WHERE e.projeto_id = p.id
          ), '[]'::json) AS entregas,
          COALESCE((
            SELECT json_agg(json_build_object(
              'numero', ae.numero, 'nome', ae.nome, 'oe_codigo', oe.codigo
            ))
            FROM projeto_acoes pa
            JOIN acoes_estrategicas ae ON ae.id = pa.acao_estrategica_id
            LEFT JOIN objetivos_estrategicos oe ON oe.id = ae.objetivo_estrategico_id
            WHERE pa.projeto_id = p.id
          ), '[]'::json) AS acoes
        FROM projetos p
        LEFT JOIN setores s ON s.id = p.setor_lider_id
        ORDER BY p.nome
      `
    
    console.log(`[API Relatorios] Retornando ${projetos.length} projetos`)
    
    return NextResponse.json({
      profile: { ...profile, setores: profile.setor_id ? { codigo: profile.setor_codigo } : null },
      objetivos, acoes, setores,
      profiles: profiles.map((p: any) => ({
        ...p, setores: p.setor_id ? { codigo: p.setor_codigo } : null,
      })),
      projetos,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
