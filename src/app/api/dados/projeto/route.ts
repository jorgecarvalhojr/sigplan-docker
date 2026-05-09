export const dynamic = 'force-dynamic'
/**
 * POST /api/dados/projeto
 * Cria um novo projeto completo com entregas e atividades.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    const [profile] = await sql`SELECT id, nome, role, setor_id FROM profiles WHERE id = ${user.id} LIMIT 1`
    if (!profile || !['admin', 'master', 'gestor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const {
      nome, descricao, problema_resolve, setor_lider_id, data_inicio,
      responsavel_id, tipo_acao, dependencias_projetos, indicador_sucesso,
      acoes_ids, indicadores, riscos, entregas: entregasData,
    } = body

    // Inserir projeto
    const [projeto] = await sql`
      INSERT INTO projetos (nome, descricao, problema_resolve, setor_lider_id, criado_por,
        data_inicio, responsavel_id, tipo_acao, dependencias_projetos, indicador_sucesso)
      VALUES (
        ${nome}, ${descricao}, ${problema_resolve}, ${setor_lider_id}, ${user.id},
        ${data_inicio ?? null}, ${responsavel_id ?? null},
        ${tipo_acao ? sql.array(tipo_acao) : null},
        ${dependencias_projetos ?? null}, ${indicador_sucesso ?? null}
      )
      RETURNING id
    `
    const projetoId = projeto.id

    // Ações estratégicas
    if (Array.isArray(acoes_ids)) {
      for (const acaoId of acoes_ids) {
        await sql`INSERT INTO projeto_acoes (projeto_id, acao_estrategica_id) VALUES (${projetoId}, ${acaoId})`
      }
    }

    // Indicadores
    if (Array.isArray(indicadores)) {
      for (const ind of indicadores) {
        await sql`INSERT INTO indicadores (projeto_id, nome, formula, fonte_dados, periodicidade, unidade_medida, responsavel, meta)
          VALUES (${projetoId}, ${ind.nome ?? null}, ${ind.formula ?? null}, ${ind.fonte_dados ?? null},
            ${ind.periodicidade ?? null}, ${ind.unidade_medida ?? null}, ${ind.responsavel ?? null}, ${ind.meta ?? null})`
      }
    }

    // Riscos
    if (Array.isArray(riscos)) {
      for (const r of riscos) {
        await sql`INSERT INTO riscos (projeto_id, natureza, probabilidade, medida_resposta)
          VALUES (${projetoId}, ${r.natureza ?? null}, ${r.probabilidade ?? null}, ${r.medida_resposta ?? null})`
      }
    }

    // Audit log
    await sql`
      INSERT INTO audit_log (usuario_id, usuario_nome, tipo_acao, entidade, entidade_id, conteudo_novo)
      VALUES (${user.id}, ${profile.nome}, 'create', 'projeto', ${projetoId},
        ${JSON.stringify({ nome, setor_lider_id })}::jsonb)
    `

    // Entregas e atividades
    if (Array.isArray(entregasData)) {
      for (const entrega of entregasData) {
        const [novaEntrega] = await sql`
          INSERT INTO entregas (projeto_id, nome, descricao, criterios_aceite, dependencias_criticas,
            data_inicio, data_final_prevista, status, responsavel_entrega_id, orgao_responsavel_setor_id)
          VALUES (
            ${projetoId}, ${entrega.nome}, ${entrega.descricao ?? ''},
            ${entrega.criterios_aceite ?? null}, ${entrega.dependencias_criticas ?? null},
            ${entrega.data_inicio ?? null}, ${entrega.data_final_prevista ?? null},
            ${entrega.status ?? 'aberta'},
            ${entrega.responsavel_entrega_id ?? null}, ${entrega.orgao_responsavel_setor_id ?? null}
          )
          RETURNING id
        `
        // Participantes da entrega
        if (Array.isArray(entrega.participantes)) {
          for (const p of entrega.participantes) {
            await sql`INSERT INTO entrega_participantes (entrega_id, setor_id, papel, tipo_participante)
              VALUES (${novaEntrega.id}, ${p.setor_id ?? null}, ${p.papel}, ${p.tipo_participante ?? 'setor'})`
          }
        }

        // Atividades
        if (Array.isArray(entrega.atividades)) {
          for (const ativ of entrega.atividades) {
            const [novaAtiv] = await sql`
              INSERT INTO atividades (entrega_id, nome, descricao, data_prevista, status, responsavel_atividade_id)
              VALUES (${novaEntrega.id}, ${ativ.nome}, ${ativ.descricao ?? ''},
                ${ativ.data_prevista ?? null}, ${ativ.status ?? 'aberta'},
                ${ativ.responsavel_atividade_id ?? null})
              RETURNING id
            `
            if (Array.isArray(ativ.participantes)) {
              for (const p of ativ.participantes) {
                await sql`INSERT INTO atividade_participantes (atividade_id, setor_id, user_id, papel, tipo_participante)
                  VALUES (${novaAtiv.id}, ${p.setor_id ?? null}, ${p.user_id ?? null}, ${p.papel}, ${p.tipo_participante ?? 'setor'})`
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, id: projetoId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

// GET: dados iniciais para o formulário novo projeto
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    const [profile] = await sql`
      SELECT p.*, s.codigo AS setor_codigo FROM profiles p
      LEFT JOIN setores s ON s.id = p.setor_id
      WHERE p.id = ${user.id} LIMIT 1
    `

    const [setores, acoes, configuracoes, usuarios] = await Promise.all([
      sql`SELECT id, codigo, nome_completo FROM setores ORDER BY codigo`,
      sql`SELECT id, numero, nome FROM acoes_estrategicas ORDER BY numero`,
      sql`SELECT chave, valor FROM configuracoes`,
      sql`
        SELECT p.id, p.nome, p.setor_id, s.codigo AS setor_codigo
        FROM profiles p LEFT JOIN setores s ON s.id = p.setor_id
        WHERE p.role <> 'solicitante' AND p.ativo = true ORDER BY p.nome
      `,
    ])

    const cfgMap: Record<string, string> = {}
    configuracoes.forEach((c: any) => { cfgMap[c.chave] = c.valor })

    return NextResponse.json({
      profile: profile ? {
        ...profile,
        setores: profile.setor_id ? { codigo: profile.setor_codigo } : null,
      } : null,
      setores,
      acoes,
      configuracoes: cfgMap,
      usuarios: usuarios.map((u: any) => ({
        id: u.id, nome: u.nome, setor_id: u.setor_id,
        setores: u.setor_id ? { codigo: u.setor_codigo } : null,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

