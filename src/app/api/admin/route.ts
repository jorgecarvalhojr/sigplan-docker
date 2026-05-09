import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    
    const [profile] = await sql`SELECT role FROM profiles WHERE id = ${session.user.id} LIMIT 1`
    if (!profile || !['admin', 'master'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    switch (type) {
      case 'observacoes': {
        const status = searchParams.get('status')
        const bloco = searchParams.get('bloco')
        let query = sql`
          SELECT o.*, ae.numero as acao_numero, ae.nome as acao_nome
          FROM observacoes o
          JOIN acoes_estrategicas ae ON ae.id = o.acao_estrategica_id
          WHERE 1=1
        `
        if (status) query = sql`${query} AND o.status = ${status}`
        if (bloco) query = sql`${query} AND o.bloco = ${bloco}`
        
        const obs = await sql`${query} ORDER BY o.created_at DESC`
        return NextResponse.json(obs)
      }

      case 'usuarios': {
        const users = await sql`
          SELECT p.*, s.codigo as setor_codigo, s.nome_completo as setor_nome
          FROM profiles p
          LEFT JOIN setores s ON s.id = p.setor_id
          ORDER BY p.nome
        `
        return NextResponse.json(users)
      }

      case 'setores': {
        const setores = await sql`SELECT * FROM setores ORDER BY codigo`
        return NextResponse.json(setores)
      }

      case 'config': {
        const configs = await sql`SELECT * FROM configuracoes ORDER BY chave`
        return NextResponse.json(configs)
      }

      case 'solicitacoes': {
        const sols = await sql`
          SELECT s.*, p.nome as projeto_nome
          FROM solicitacoes_alteracao s
          LEFT JOIN projetos p ON p.id = s.projeto_id
          ORDER BY s.created_at DESC
        `
        return NextResponse.json(sols)
      }

      case 'audit_log': {
        const logs = await sql`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200`
        return NextResponse.json(logs)
      }

      case 'setores_deps': {
        const id = searchParams.get('id')
        if (!id) return NextResponse.json({ error: 'ID ausente' }, { status: 400 })
        const [deps] = await sql`SELECT * FROM check_setor_dependencies(${id})`
        return NextResponse.json(deps)
      }

      case 'user_setor_impact': {
        const userId = searchParams.get('userId')
        const oldSetorId = searchParams.get('oldSetorId')
        const newSetorId = searchParams.get('newSetorId')
        if (!userId) return NextResponse.json({ error: 'User ID ausente' }, { status: 400 })

        let entregasCount = 0
        let atividadesCount = 0
        let projetosPerdeCount = 0
        let projetosGanhaCount = 0

        if (oldSetorId && oldSetorId !== 'null') {
          const [ec] = await sql`
            SELECT count(*) FROM entregas
            WHERE responsavel_entrega_id = ${userId}
            AND orgao_responsavel_setor_id = ${oldSetorId}
          `
          entregasCount = Number(ec.count)

          const atividades = await sql`SELECT id, entrega_id FROM atividades WHERE responsavel_atividade_id = ${userId}`
          if (atividades.length > 0 && newSetorId && newSetorId !== 'null') {
            const entregaIds = Array.from(new Set(atividades.map((a: any) => a.entrega_id)))
            const participantes = await sql`
              SELECT entrega_id FROM entrega_participantes
              WHERE entrega_id IN ${sql(entregaIds)}
              AND setor_id = ${newSetorId}
            `
            const entregasComNovoSetor = new Set(participantes.map((p: any) => p.entrega_id))
            atividadesCount = atividades.filter((a: any) => !entregasComNovoSetor.has(a.entrega_id)).length
          } else if (atividades.length > 0 && (!newSetorId || newSetorId === 'null')) {
            atividadesCount = atividades.length
          }

          const [plc] = await sql`SELECT count(*) FROM projetos WHERE setor_lider_id = ${oldSetorId}`
          projetosPerdeCount = Number(plc.count)
        }

        if (newSetorId && newSetorId !== 'null') {
          const [pgc] = await sql`SELECT count(*) FROM projetos WHERE setor_lider_id = ${newSetorId}`
          projetosGanhaCount = Number(pgc.count)
        }

        return NextResponse.json({
          entregasCount,
          atividadesCount,
          projetosPerdeCount,
          projetosGanhaCount
        })
      }

      default:
        return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const [profile] = await sql`SELECT role, nome FROM profiles WHERE id = ${session.user.id} LIMIT 1`
    if (!profile || !['admin', 'master'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const { action, payload } = body

    switch (action) {
      case 'update_obs': {
        await sql`
          UPDATE observacoes SET
            status = ${payload.status},
            resposta_admin = ${payload.resposta_admin || null},
            respondido_por = ${session.user.id},
            respondido_em = NOW()
          WHERE id = ${payload.id}
        `
        return NextResponse.json({ success: true })
      }

      case 'update_user_role': {
        await sql`UPDATE profiles SET role = ${payload.role} WHERE id = ${payload.userId}`
        return NextResponse.json({ success: true })
      }

      case 'update_user_setor': {
        const { userId, setorId } = payload
        const [user] = await sql`SELECT * FROM profiles WHERE id = ${userId} LIMIT 1`
        if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

        const oldSetorId = user.setor_id
        if (oldSetorId === setorId) return NextResponse.json({ success: true })

        // 1. Update profile setor
        await sql`UPDATE profiles SET setor_id = ${setorId} WHERE id = ${userId}`

        // 2. SET NULL entregas.responsavel_entrega_id where incompatible
        if (oldSetorId) {
          await sql`
            UPDATE entregas SET responsavel_entrega_id = NULL
            WHERE responsavel_entrega_id = ${userId}
            AND orgao_responsavel_setor_id = ${oldSetorId}
          `
        }

        // 3. SET NULL atividades.responsavel_atividade_id where entrega sectors don't include new setor
        const atividades = await sql`SELECT id, entrega_id FROM atividades WHERE responsavel_atividade_id = ${userId}`
        if (atividades.length > 0) {
          if (setorId) {
            const entregaIds = Array.from(new Set(atividades.map((a: any) => a.entrega_id)))
            const participantes = await sql`
              SELECT entrega_id FROM entrega_participantes
              WHERE entrega_id IN ${sql(entregaIds)}
              AND setor_id = ${setorId}
            `
            const entregasComNovoSetor = new Set(participantes.map((p: any) => p.entrega_id))
            const atividadesParaRemover = atividades.filter((a: any) => !entregasComNovoSetor.has(a.entrega_id)).map((a: any) => a.id)
            if (atividadesParaRemover.length > 0) {
              await sql`UPDATE atividades SET responsavel_atividade_id = NULL WHERE id IN ${sql(atividadesParaRemover)}`
            }
          } else {
            await sql`UPDATE atividades SET responsavel_atividade_id = NULL WHERE responsavel_atividade_id = ${userId}`
          }
        }

        // 4. Update atividade_participantes setor_id for active atividades
        if (setorId) {
          await sql`
            UPDATE atividade_participantes SET setor_id = ${setorId}
            WHERE user_id = ${userId}
            AND tipo_participante = 'usuario'
            AND atividade_id IN (
              SELECT id FROM atividades WHERE status NOT IN ('resolvida', 'cancelada')
            )
          `
        }

        // 5. Audit log
        const [oldSetor] = oldSetorId ? await sql`SELECT codigo FROM setores WHERE id = ${oldSetorId}` : [{ codigo: 'Nenhum' }]
        const [newSetor] = setorId ? await sql`SELECT codigo FROM setores WHERE id = ${setorId}` : [{ codigo: 'Nenhum' }]

        await sql`
          INSERT INTO audit_log (usuario_id, usuario_nome, tipo_acao, entidade, entidade_id, conteudo_anterior, conteudo_novo, descricao)
          VALUES (
            ${session.user.id}, ${profile.nome}, 'update', 'profile', ${userId},
            ${JSON.stringify({ setor_id: oldSetorId })}, ${JSON.stringify({ setor_id: setorId })},
            ${`Setor alterado de ${oldSetor.codigo} para ${newSetor.codigo}`}
          )
        `

        return NextResponse.json({ success: true })
      }

      case 'save_setor': {
        const { id, codigo, nome_completo } = payload
        if (id) {
          await sql`UPDATE setores SET codigo = ${codigo}, nome_completo = ${nome_completo} WHERE id = ${id}`
        } else {
          await sql`INSERT INTO setores (codigo, nome_completo) VALUES (${codigo}, ${nome_completo})`
        }
        return NextResponse.json({ success: true })
      }

      case 'delete_setor': {
        const { id, transferToId } = payload
        if (transferToId) {
          // Transferir tudo antes de deletar
          await sql`UPDATE profiles SET setor_id = ${transferToId} WHERE setor_id = ${id}`
          await sql`UPDATE projetos SET setor_lider_id = ${transferToId} WHERE setor_lider_id = ${id}`
          await sql`UPDATE entregas SET orgao_responsavel_setor_id = ${transferToId} WHERE orgao_responsavel_setor_id = ${id}`
          await sql`UPDATE entrega_participantes SET setor_id = ${transferToId} WHERE setor_id = ${id}`
          await sql`UPDATE atividade_participantes SET setor_id = ${transferToId} WHERE setor_id = ${id}`
          await sql`UPDATE panoramico_setores SET setor_id = ${transferToId} WHERE setor_id = ${id}`
          await sql`UPDATE ficha_setores SET setor_id = ${transferToId} WHERE setor_id = ${id}`
        }
        await sql`DELETE FROM setores WHERE id = ${id}`
        return NextResponse.json({ success: true })
      }

      case 'save_config': {
        await sql`
          INSERT INTO configuracoes (chave, valor, atualizado_por, updated_at)
          VALUES (${payload.chave}, ${payload.valor}, ${session.user.id}, NOW())
          ON CONFLICT (chave) DO UPDATE SET
            valor = EXCLUDED.valor,
            atualizado_por = EXCLUDED.atualizado_por,
            updated_at = NOW()
        `
        return NextResponse.json({ success: true })
      }

      case 'process_solicitacao': {
        // payload: { id, status, resposta_gestor }
        await sql`
          UPDATE solicitacoes_alteracao SET
            status = ${payload.status},
            resposta_gestor = ${payload.resposta_gestor || null},
            analisado_por = ${session.user.id},
            analisado_em = NOW()
          WHERE id = ${payload.id}
        `
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
