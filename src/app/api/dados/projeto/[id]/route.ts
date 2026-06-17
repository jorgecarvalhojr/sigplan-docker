import logger from '@/lib/logger'
export const dynamic = 'force-dynamic'
/**
 * GET /api/dados/projeto/[id]
 * Retorna projeto completo com entregas, atividades, indicadores, riscos, etc.
 *
 * POST /api/dados/projeto/[id]
 * Rota unificada de mutação via action: { action, ...payload }
 * Actions: update_projeto | delete_projeto | update_entrega | delete_entrega |
 *          update_atividade | delete_atividade | create_atividade |
 *          solicitacao_alteracao | update_status
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

type Params = { params: { id: string } }

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  console.log(`GET /api/dados/projeto/${params.id} request received`)
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    const id = parseInt(params.id)
    if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const [profile] = await sql`
      SELECT p.*, s.codigo AS setor_codigo, s.nome_completo AS setor_nome
      FROM profiles p LEFT JOIN setores s ON s.id = p.setor_id
      WHERE p.id = ${user.id} LIMIT 1
    `

    const [projeto] = await sql`
      SELECT p.*, s.codigo AS setor_lider_codigo, s.nome_completo AS setor_lider_nome,
        COALESCE((
          SELECT json_agg(json_build_object('acao_estrategica_id', pa.acao_estrategica_id,
            'numero', ae.numero, 'nome', ae.nome))
          FROM projeto_acoes pa JOIN acoes_estrategicas ae ON ae.id = pa.acao_estrategica_id
          WHERE pa.projeto_id = p.id
        ), '[]') AS acoes,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', e.id, 'nome', e.nome, 'descricao', e.descricao,
            'data_inicio', e.data_inicio, 'data_final_prevista', e.data_final_prevista,
            'status', e.status, 'motivo_status', e.motivo_status,
            'criterios_aceite', e.criterios_aceite,
            'dependencias_criticas', e.dependencias_criticas,
            'responsavel_entrega_id', e.responsavel_entrega_id,
            'orgao_responsavel_setor_id', e.orgao_responsavel_setor_id,
            'resultado_descricao', e.resultado_descricao,
            'resultado_arquivo_path', e.resultado_arquivo_path,
            'resultado_arquivo_nome', e.resultado_arquivo_nome,
            'resultado_arquivo_tamanho', e.resultado_arquivo_tamanho,
            'resultado_arquivo_enviado_em', e.resultado_arquivo_enviado_em,
            'participantes', (
              SELECT COALESCE(json_agg(json_build_object(
                'id', ep.id, 'setor_id', ep.setor_id, 'papel', ep.papel,
                'tipo_participante', ep.tipo_participante, 'setor_codigo', ss.codigo
              )), '[]'::json)
              FROM entrega_participantes ep LEFT JOIN setores ss ON ss.id = ep.setor_id
              WHERE ep.entrega_id = e.id
            ),
            'atividades', (
              SELECT COALESCE(json_agg(json_build_object(
                'id', a.id, 'nome', a.nome, 'descricao', a.descricao,
                'data_prevista', a.data_prevista, 'status', a.status,
                'motivo_status', a.motivo_status,
                'responsavel_atividade_id', a.responsavel_atividade_id,
                'resultado_descricao', a.resultado_descricao,
                'resultado_arquivo_path', a.resultado_arquivo_path,
                'resultado_arquivo_nome', a.resultado_arquivo_nome,
                'resultado_arquivo_tamanho', a.resultado_arquivo_tamanho,
                'resultado_arquivo_enviado_em', a.resultado_arquivo_enviado_em,
                'participantes', (
                  SELECT COALESCE(json_agg(json_build_object(
                    'id', ap.id, 'setor_id', ap.setor_id, 'user_id', ap.user_id,
                    'papel', ap.papel, 'tipo_participante', ap.tipo_participante,
                    'setor_codigo', sa.codigo
                  )), '[]'::json)
                  FROM atividade_participantes ap LEFT JOIN setores sa ON sa.id = ap.setor_id
                  WHERE ap.atividade_id = a.id
                )
              ) ORDER BY a.id), '[]'::json)
              FROM atividades a WHERE a.entrega_id = e.id
            )
          ) ORDER BY e.id)
          FROM entregas e WHERE e.projeto_id = p.id
        ), '[]'::json) AS entregas
      FROM projetos p JOIN setores s ON s.id = p.setor_lider_id
      WHERE p.id = ${id}
      LIMIT 1
    `
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

    const [indicadores, riscos, solicitacoes, setores, usuarios, configuracoes, acoes] = await Promise.all([
      sql`SELECT * FROM indicadores WHERE projeto_id = ${id} ORDER BY id`,
      sql`SELECT * FROM riscos WHERE projeto_id = ${id} ORDER BY id`,
      sql`SELECT * FROM solicitacoes_alteracao WHERE projeto_id = ${id} AND status = 'em_analise' ORDER BY created_at DESC`,
      sql`SELECT id, codigo, nome_completo FROM setores ORDER BY codigo`,
      sql`
        SELECT p.id, p.nome, p.setor_id, p.role, s.codigo AS setor_codigo
        FROM profiles p LEFT JOIN setores s ON s.id = p.setor_id
        WHERE p.role <> 'solicitante' AND p.ativo = true ORDER BY p.nome
      `,
      sql`SELECT chave, valor FROM configuracoes`,
      sql`SELECT id, numero, nome FROM acoes_estrategicas ORDER BY numero`,
    ])

    const cfgMap: Record<string, string> = {}
    configuracoes.forEach((c: any) => { cfgMap[c.chave] = c.valor })

    const responseData = {
      profile: profile ? {
        ...profile,
        setores: profile.setor_id ? { codigo: profile.setor_codigo, nome_completo: profile.setor_nome } : null,
      } : null,
      projeto,
      indicadores,
      riscos,
      solicitacoes,
      setores,
      usuarios: usuarios.map((u: any) => ({
        id: u.id, nome: u.nome, setor_id: u.setor_id, role: u.role,
        setores: u.setor_id ? { codigo: u.setor_codigo } : null,
      })),
      configuracoes: cfgMap,
      acoes,
    }

    console.log('Sending response data...')
    try {
      JSON.stringify(responseData)
    } catch (serializeErr) {
      logger.error('Serialization error:', serializeErr)
      throw serializeErr
    }

    return NextResponse.json(responseData)
  } catch (err: any) {
    logger.error('GET /api/dados/projeto error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

// ─── POST (mutações) ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  console.log(`POST /api/dados/projeto/${params.id} request received`)
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    const id = parseInt(params.id)
    const body = await request.json()
    const { action, ...payload } = body
    console.log(`Action: ${action}`, payload)

    const [profile] = await sql`SELECT id, nome, role, setor_id FROM profiles WHERE id = ${user.id} LIMIT 1`
    if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 403 })

    switch (action) {
      case 'update_status': {
        await sql`UPDATE projetos SET status = ${payload.status} WHERE id = ${id}`
        return NextResponse.json({ success: true })
      }

      case 'update_projeto': {
        const { nome, descricao, problema_resolve, setor_lider_id, data_inicio,
                responsavel_id, tipo_acao, dependencias_projetos, indicador_sucesso,
                acoes_ids, indicadores: inds, riscos: rscos } = payload

        await sql`
          UPDATE projetos SET
            nome = ${nome}, descricao = ${descricao},
            problema_resolve = ${problema_resolve},
            setor_lider_id = ${setor_lider_id},
            data_inicio = ${data_inicio ?? null},
            responsavel_id = ${responsavel_id ?? null},
            tipo_acao = ${tipo_acao ? sql.array(tipo_acao) : null},
            dependencias_projetos = ${dependencias_projetos ?? null},
            indicador_sucesso = ${indicador_sucesso ?? null}
          WHERE id = ${id}
        `
        // Atualizar ações
        if (Array.isArray(acoes_ids)) {
          await sql`DELETE FROM projeto_acoes WHERE projeto_id = ${id}`
          if (acoes_ids.length > 0) {
            for (const acao_id of acoes_ids) {
              await sql`INSERT INTO projeto_acoes (projeto_id, acao_estrategica_id) VALUES (${id}, ${acao_id})`
            }
          }
        }
        // Indicadores
        if (Array.isArray(inds)) {
          await sql`DELETE FROM indicadores WHERE projeto_id = ${id}`
          for (const ind of inds) {
            await sql`INSERT INTO indicadores (projeto_id, nome, formula, fonte_dados, periodicidade, unidade_medida, responsavel, meta)
              VALUES (${id}, ${ind.nome ?? null}, ${ind.formula ?? null}, ${ind.fonte_dados ?? null},
                ${ind.periodicidade ?? null}, ${ind.unidade_medida ?? null}, ${ind.responsavel ?? null}, ${ind.meta ?? null})`
          }
        }
        // Riscos
        if (Array.isArray(rscos)) {
          await sql`DELETE FROM riscos WHERE projeto_id = ${id}`
          for (const r of rscos) {
            await sql`INSERT INTO riscos (projeto_id, natureza, probabilidade, medida_resposta)
              VALUES (${id}, ${r.natureza ?? null}, ${r.probabilidade ?? null}, ${r.medida_resposta ?? null})`
          }
        }
        return NextResponse.json({ success: true })
      }

      case 'delete_projeto': {
        await sql`DELETE FROM projetos WHERE id = ${id}`
        return NextResponse.json({ success: true })
      }

      case 'update_entrega': {
        // payload achatado: { id, nome, descricao, ..., participantes }
        const entregaId = payload.id ?? payload.entregaId
        const dados = payload.dados ?? payload
        const participantes = payload.participantes
        await sql`
          UPDATE entregas SET
            nome = ${dados.nome}, descricao = ${dados.descricao},
            criterios_aceite = ${dados.criterios_aceite ?? null},
            dependencias_criticas = ${dados.dependencias_criticas ?? null},
            data_inicio = ${dados.data_inicio ?? null},
            data_final_prevista = ${dados.data_final_prevista ?? null},
            status = ${dados.status}, motivo_status = ${dados.motivo_status ?? null},
            responsavel_entrega_id = ${dados.responsavel_entrega_id ?? null},
            orgao_responsavel_setor_id = ${dados.orgao_responsavel_setor_id ?? null},
            resultado_descricao = ${dados.resultado_descricao ?? null},
            resultado_arquivo_path = ${dados.resultado_arquivo_path ?? null},
            resultado_arquivo_nome = ${dados.resultado_arquivo_nome ?? null},
            resultado_arquivo_tamanho = ${dados.resultado_arquivo_tamanho ?? null},
            resultado_arquivo_enviado_em = ${dados.resultado_arquivo_enviado_em ?? null}
          WHERE id = ${entregaId}
        `
        if (Array.isArray(participantes)) {
          await sql`DELETE FROM entrega_participantes WHERE entrega_id = ${entregaId}`
          for (const p of participantes) {
            await sql`INSERT INTO entrega_participantes (entrega_id, setor_id, papel, tipo_participante)
              VALUES (${entregaId}, ${p.setor_id ?? null}, ${p.papel}, ${p.tipo_participante ?? 'setor'})`
          }
        }
        return NextResponse.json({ success: true })
      }

      case 'delete_entrega': {
        const delEntregaId = payload.entregaId ?? payload.id
        await sql`DELETE FROM entregas WHERE id = ${delEntregaId}`
        return NextResponse.json({ success: true })
      }

      case 'create_atividade': {
        // payload achatado: { entrega_id, nome, descricao, ..., participantes }
        const createEntregaId = payload.entregaId ?? payload.entrega_id
        const createDados = payload.dados ?? payload
        const createParticipantes = payload.participantes
        const [nova] = await sql`
          INSERT INTO atividades (entrega_id, nome, descricao, data_prevista, status, responsavel_atividade_id)
          VALUES (${createEntregaId}, ${createDados.nome}, ${createDados.descricao},
            ${createDados.data_prevista ?? null}, ${createDados.status ?? 'aberta'},
            ${createDados.responsavel_atividade_id ?? null})
          RETURNING id
        `
        if (Array.isArray(createParticipantes) && createParticipantes.length > 0) {
          for (const p of createParticipantes) {
            await sql`INSERT INTO atividade_participantes (atividade_id, setor_id, user_id, papel, tipo_participante)
              VALUES (${nova.id}, ${p.setor_id ?? null}, ${p.user_id ?? null}, ${p.papel}, ${p.tipo_participante ?? 'setor'})`
          }
        }
        return NextResponse.json({ success: true, id: nova.id })
      }

      case 'update_atividade': {
        // payload achatado: { id, nome, descricao, ..., participantes }
        const atividadeId = payload.atividadeId ?? payload.id
        const dadosAtiv = payload.dados ?? payload
        const participantesAtiv = payload.participantes
        await sql`
          UPDATE atividades SET
            nome = ${dadosAtiv.nome}, descricao = ${dadosAtiv.descricao},
            data_prevista = ${dadosAtiv.data_prevista ?? null},
            status = ${dadosAtiv.status}, motivo_status = ${dadosAtiv.motivo_status ?? null},
            responsavel_atividade_id = ${dadosAtiv.responsavel_atividade_id ?? null},
            resultado_descricao = ${dadosAtiv.resultado_descricao ?? null},
            resultado_arquivo_path = ${dadosAtiv.resultado_arquivo_path ?? null},
            resultado_arquivo_nome = ${dadosAtiv.resultado_arquivo_nome ?? null},
            resultado_arquivo_tamanho = ${dadosAtiv.resultado_arquivo_tamanho ?? null},
            resultado_arquivo_enviado_em = ${dadosAtiv.resultado_arquivo_enviado_em ?? null}
          WHERE id = ${atividadeId}
        `
        if (Array.isArray(participantesAtiv)) {
          await sql`DELETE FROM atividade_participantes WHERE atividade_id = ${atividadeId}`
          for (const p of participantesAtiv) {
            await sql`INSERT INTO atividade_participantes (atividade_id, setor_id, user_id, papel, tipo_participante)
              VALUES (${atividadeId}, ${p.setor_id ?? null}, ${p.user_id ?? null}, ${p.papel}, ${p.tipo_participante ?? 'setor'})`
          }
        }
        return NextResponse.json({ success: true })
      }

      case 'delete_atividade': {
        const delAtivId = payload.atividadeId ?? payload.id
        await sql`DELETE FROM atividades WHERE id = ${delAtivId}`
        return NextResponse.json({ success: true })
      }

      case 'toggle_hibernando': {
        await sql`UPDATE projetos SET status = ${payload.status} WHERE id = ${id}`
        return NextResponse.json({ success: true })
      }

      case 'cancel_solicitacao': {
        await sql`UPDATE solicitacoes_alteracao SET status = 'cancelada' WHERE id = ${payload.solicitacao_id}`
        return NextResponse.json({ success: true })
      }

      // Alias: page.tsx envia 'create_solicitacao'
      case 'create_solicitacao':
      case 'solicitacao_alteracao': {
        await sql`
          INSERT INTO solicitacoes_alteracao
            (solicitante_id, solicitante_nome, tipo_entidade, entidade_id, entidade_nome,
             projeto_id, tipo_operacao, dados_alteracao, status)
          VALUES (
            ${user.id}, ${profile.nome},
            ${payload.tipo_entidade}, ${payload.entidade_id}, ${payload.entidade_nome},
            ${id}, ${payload.tipo_operacao},
            ${payload.dados_alteracao ?? {}}, 'em_analise'
          )
        `
        return NextResponse.json({ success: true })
      }

      case 'audit_log': {
        await sql`
          INSERT INTO audit_log (usuario_id, usuario_nome, tipo_acao, entidade, entidade_id, conteudo_anterior, conteudo_novo)
          VALUES (
            ${user.id}, ${profile.nome},
            ${payload.tipo_acao}, ${payload.entidade}, ${payload.entidade_id},
            ${payload.conteudo_anterior ?? null},
            ${payload.conteudo_novo ?? null}
          )
        `
        return NextResponse.json({ success: true })
      }

      case 'alerta': {
        for (const alerta of (payload.alertas ?? [])) {
          await sql`
            INSERT INTO alertas (destinatario_id, tipo, entidade, entidade_id, entidade_nome,
              projeto_id, projeto_nome, autor_id, autor_nome, descricao)
            VALUES (
              ${alerta.destinatario_id}, ${alerta.tipo}, ${alerta.entidade},
              ${alerta.entidade_id}, ${alerta.entidade_nome ?? null},
              ${alerta.projeto_id ?? null}, ${alerta.projeto_nome ?? null},
              ${user.id}, ${profile.nome}, ${alerta.descricao ?? null}
            )
          `
        }
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: `Action desconhecida: ${action}` }, { status: 400 })
    }
  } catch (err: any) {
    logger.error('POST /api/dados/projeto error:', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
