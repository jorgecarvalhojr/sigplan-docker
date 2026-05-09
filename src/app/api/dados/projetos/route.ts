export const dynamic = 'force-dynamic'
/**
 * GET /api/dados/projetos
 * Retorna todos os projetos com joins completos necessários para a listagem
 * (ProjetoCard). Suporta filtro de status via query param ?status=ativos|concluidos|hibernando
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    const [projetos, solicitacoes, objetivos, acoes, setores] = await Promise.all([
      // Projetos com setor líder e ações vinculadas
      sql`
        SELECT
          p.id, p.nome, p.descricao, p.setor_lider_id, p.tipo_acao,
          p.responsavel_id, p.status, p.data_inicio, p.created_at,
          p.codigo_sequencial,
          s.codigo AS setor_lider_codigo, s.nome_completo AS setor_lider_nome,
          -- Ações estratégicas vinculadas (JSON array)
          COALESCE((
            SELECT json_agg(json_build_object(
              'numero', ae.numero, 'nome', ae.nome,
              'oe_codigo', oe.codigo
            ))
            FROM projeto_acoes pa
            JOIN acoes_estrategicas ae ON ae.id = pa.acao_estrategica_id
            LEFT JOIN objetivos_estrategicos oe ON oe.id = ae.objetivo_estrategico_id
            WHERE pa.projeto_id = p.id
          ), '[]') AS acoes,
          -- Entregas com participantes e atividades
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', e.id, 'nome', e.nome,
              'data_final_prevista', e.data_final_prevista,
              'data_inicio', e.data_inicio,
              'status', e.status,
              'responsavel_entrega_id', e.responsavel_entrega_id,
              'orgao_responsavel_setor_id', e.orgao_responsavel_setor_id,
              'entrega_participantes', (
                SELECT COALESCE(json_agg(json_build_object(
                  'setor_id', ep.setor_id, 'tipo_participante', ep.tipo_participante,
                  'setor_codigo', ss.codigo
                )), '[]')
                FROM entrega_participantes ep
                LEFT JOIN setores ss ON ss.id = ep.setor_id
                WHERE ep.entrega_id = e.id
              ),
              'atividades', (
                SELECT COALESCE(json_agg(json_build_object(
                  'id', a.id, 'nome', a.nome,
                  'data_prevista', a.data_prevista,
                  'status', a.status,
                  'responsavel_atividade_id', a.responsavel_atividade_id,
                  'atividade_participantes', (
                    SELECT COALESCE(json_agg(json_build_object(
                      'setor_id', ap.setor_id, 'user_id', ap.user_id,
                      'tipo_participante', ap.tipo_participante,
                      'setor_codigo', sa.codigo
                    )), '[]'::json)
                    FROM atividade_participantes ap
                    LEFT JOIN setores sa ON sa.id = ap.setor_id
                    WHERE ap.atividade_id = a.id
                  )
                )), '[]'::json)
                FROM atividades a
                WHERE a.entrega_id = e.id
              )
            ))
            FROM entregas e
            WHERE e.projeto_id = p.id
          ), '[]'::json) AS entregas
        FROM projetos p
        JOIN setores s ON s.id = p.setor_lider_id
        ORDER BY p.nome
      `,
      // Solicitações pendentes (count por projeto)
      sql`
        SELECT projeto_id, COUNT(*)::int AS total
        FROM solicitacoes_alteracao
        WHERE status = 'em_analise'
        GROUP BY projeto_id
      `,
      sql`SELECT codigo, nome FROM objetivos_estrategicos ORDER BY codigo`,
      sql`
        SELECT ae.numero, ae.nome, oe.codigo AS oe_codigo
        FROM acoes_estrategicas ae
        LEFT JOIN objetivos_estrategicos oe ON oe.id = ae.objetivo_estrategico_id
        WHERE ae.visivel_enquadramento = true OR ae.visivel_enquadramento IS NULL
        ORDER BY ae.numero
      `,
      sql`SELECT id, codigo, nome_completo FROM setores ORDER BY codigo`,
    ])

    // Mensagens não lidas (opcional — falha silenciosa)
    let mensagensNaoLidas: Record<number, number> = {}
    try {
      const [meuPerfil] = await sql`SELECT id, role, setor_id FROM profiles WHERE id = ${user.id}`
      if (meuPerfil) {
        const isAdmMst = meuPerfil.role === 'admin' || meuPerfil.role === 'master'
        const allMsgs = await sql`SELECT id, projeto_id, autor_id FROM mensagens_projeto`

        if (allMsgs.length > 0) {
          const myReads = await sql`SELECT mensagem_id FROM mensagem_leituras WHERE usuario_id = ${user.id}`
          const readSet = new Set(myReads.map((r: any) => r.mensagem_id))

          let myDestMsgIds: Set<number> | null = null
          if (!isAdmMst && meuPerfil.setor_id) {
            const myDests = await sql`SELECT mensagem_id FROM mensagem_destinatarios WHERE setor_id = ${meuPerfil.setor_id}`
            myDestMsgIds = new Set(myDests.map((d: any) => d.mensagem_id))
          }

          allMsgs.forEach((m: any) => {
            if (m.autor_id === user.id) return
            if (readSet.has(m.id)) return
            if (!isAdmMst && myDestMsgIds && !myDestMsgIds.has(m.id)) return
            mensagensNaoLidas[m.projeto_id] = (mensagensNaoLidas[m.projeto_id] || 0) + 1
          })
        }
      }
    } catch { /* mensagens são opcionais */ }

    const solsPorProjeto: Record<number, number> = {}
    solicitacoes.forEach((s: any) => { solsPorProjeto[s.projeto_id] = s.total })

    return NextResponse.json({
      projetos: projetos.map((p: any) => ({
        ...p,
        acoes: p.acoes || [],
        entregas: p.entregas || [],
        solicitacoes_pendentes: solsPorProjeto[p.id] || 0,
        unread_messages: mensagensNaoLidas[p.id] || 0,
      })),
      objetivos,
      acoes,
      setores,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

