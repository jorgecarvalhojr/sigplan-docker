/**
 * GET  /api/dados/relatorios/tabular  — dados consolidados para o relatório tabular
 * PATCH /api/dados/relatorios/tabular — salva um campo editável de projeto ou entrega
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getAdminProfile(userId: string) {
  const [profile] = await sql`
    SELECT p.*, s.codigo AS setor_codigo
    FROM profiles p LEFT JOIN setores s ON s.id = p.setor_id
    WHERE p.id = ${userId} LIMIT 1
  `
  return profile
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const profile = await getAdminProfile(session.user.id)
    if (!profile || (profile.role !== 'admin' && profile.role !== 'master')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Dados de referência
    const [objetivos, acoes, setores, profiles] = await Promise.all([
      sql`SELECT codigo, nome FROM objetivos_estrategicos ORDER BY codigo`,
      sql`
        SELECT ae.id, ae.numero, ae.nome,
               oe.codigo AS oe_codigo
        FROM acoes_estrategicas ae
        LEFT JOIN objetivos_estrategicos oe ON oe.id = ae.objetivo_estrategico_id
        WHERE ae.visivel_enquadramento = true OR ae.visivel_enquadramento IS NULL
        ORDER BY ae.numero
      `,
      sql`SELECT id, codigo, nome_completo FROM setores ORDER BY codigo`,
      sql`
        SELECT p.id, p.nome, p.role, p.setor_id, p.ativo, s.codigo AS setor_codigo
        FROM profiles p
        LEFT JOIN setores s ON s.id = p.setor_id
        WHERE p.role <> 'solicitante' AND p.ativo = true
        ORDER BY p.nome
      `,
    ])

    // Projetos com entregas e participantes
    const projetos = await sql`
      SELECT
        p.id,
        p.codigo_sequencial,
        p.nome,
        p.descricao,
        p.responsavel_id,
        p.status,
        p.data_inicio,
        p.tipo_acao,
        p.prioridade,
        p.impacto,
        p.condicao_execucao,
        p.regime_acompanhamento,
        p.observacao_relatorio,
        s.codigo  AS setor_lider_codigo,
        s.nome_completo AS setor_lider_nome,
        resp.nome AS responsavel_nome,
        COALESCE((
          SELECT json_agg(json_build_object(
            'numero', ae.numero,
            'oe_codigo', oe.codigo
          ))
          FROM projeto_acoes pa
          JOIN acoes_estrategicas ae ON ae.id = pa.acao_estrategica_id
          LEFT JOIN objetivos_estrategicos oe ON oe.id = ae.objetivo_estrategico_id
          WHERE pa.projeto_id = p.id
        ), '[]'::json) AS acoes,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', e.id,
            'nome', e.nome,
            'prioridade', e.prioridade,
            'status', e.status,
            'data_inicio', e.data_inicio,
            'data_final_prevista', e.data_final_prevista,
            'observacao_relatorio', e.observacao_relatorio,
            'responsavel_entrega_id', e.responsavel_entrega_id,
            'responsavel_nome', ru.nome,
            'orgao_responsavel_setor_id', e.orgao_responsavel_setor_id,
            'participantes', COALESCE((
              SELECT json_agg(json_build_object(
                'setor_id', ep.setor_id,
                'tipo_participante', ep.tipo_participante,
                'setor_codigo', ps.codigo
              ))
              FROM entrega_participantes ep
              LEFT JOIN setores ps ON ps.id = ep.setor_id
              WHERE ep.entrega_id = e.id
            ), '[]'::json),
            'atividades', COALESCE((
              SELECT json_agg(json_build_object(
                'responsavel_atividade_id', a.responsavel_atividade_id,
                'participantes', COALESCE((
                  SELECT json_agg(json_build_object(
                    'user_id', ap.user_id,
                    'setor_id', ap.setor_id,
                    'tipo_participante', ap.tipo_participante,
                    'setor_codigo', as2.codigo
                  ))
                  FROM atividade_participantes ap
                  LEFT JOIN setores as2 ON as2.id = ap.setor_id
                  WHERE ap.atividade_id = a.id
                ), '[]'::json)
              ))
              FROM atividades a WHERE a.entrega_id = e.id
            ), '[]'::json)
          ))
          FROM entregas e
          LEFT JOIN profiles ru ON ru.id = e.responsavel_entrega_id
          WHERE e.projeto_id = p.id
        ), '[]'::json) AS entregas
      FROM projetos p
      LEFT JOIN setores s ON s.id = p.setor_lider_id
      LEFT JOIN profiles resp ON resp.id = p.responsavel_id
      ORDER BY p.codigo_sequencial NULLS LAST, p.id
    `

    return NextResponse.json({
      profile: { ...profile, setores: profile.setor_id ? { codigo: profile.setor_codigo } : null },
      objetivos,
      acoes,
      setores,
      profiles: profiles.map((p: any) => ({
        ...p,
        setores: p.setor_id ? { codigo: p.setor_codigo } : null,
      })),
      projetos,
    })
  } catch (err: any) {
    console.error('[API tabular GET]', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

const ALLOWED_PROJETO_FIELDS = new Set([
  'prioridade', 'impacto', 'condicao_execucao', 'regime_acompanhamento', 'observacao_relatorio',
])

const ALLOWED_ENTREGA_FIELDS = new Set([
  'prioridade', 'observacao_relatorio',
])

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const profile = await getAdminProfile(session.user.id)
    if (!profile || (profile.role !== 'admin' && profile.role !== 'master')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const { tipo, id, field, value } = body as { tipo: 'projeto' | 'entrega'; id: number; field: string; value: string | null }

    if (!id || !field) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const val = value || null

    if (tipo === 'projeto') {
      if (!ALLOWED_PROJETO_FIELDS.has(field)) {
        return NextResponse.json({ error: 'Campo não permitido' }, { status: 400 })
      }
      if (field === 'prioridade') {
        await sql`UPDATE projetos SET prioridade = ${val} WHERE id = ${id}`
      } else if (field === 'impacto') {
        await sql`UPDATE projetos SET impacto = ${val} WHERE id = ${id}`
      } else if (field === 'condicao_execucao') {
        await sql`UPDATE projetos SET condicao_execucao = ${val} WHERE id = ${id}`
      } else if (field === 'regime_acompanhamento') {
        await sql`UPDATE projetos SET regime_acompanhamento = ${val} WHERE id = ${id}`
      } else if (field === 'observacao_relatorio') {
        await sql`UPDATE projetos SET observacao_relatorio = ${val} WHERE id = ${id}`
      }
    } else if (tipo === 'entrega') {
      if (!ALLOWED_ENTREGA_FIELDS.has(field)) {
        return NextResponse.json({ error: 'Campo não permitido' }, { status: 400 })
      }
      if (field === 'prioridade') {
        await sql`UPDATE entregas SET prioridade = ${val} WHERE id = ${id}`
      } else if (field === 'observacao_relatorio') {
        await sql`UPDATE entregas SET observacao_relatorio = ${val} WHERE id = ${id}`
      }
    } else {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[API tabular PATCH]', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
