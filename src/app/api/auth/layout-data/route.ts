export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const userId = session.user.id
    const userRole = session.user.role
    const userSetorId = session.user.setor_id

    // 1. Dados detalhados do perfil (incluindo setor)
    const [profile] = await sql`
      SELECT p.*, s.codigo as setor_codigo, s.nome_completo as setor_nome
      FROM public.profiles p
      LEFT JOIN public.setores s ON p.setor_id = s.id
      WHERE p.id = ${userId}
      LIMIT 1
    `

    // 2. Contagens administrativas (apenas para admin/master)
    let pendingSolicitacoes = 0
    let pendingSolicitantes = 0
    if (userRole === 'admin' || userRole === 'master') {
      const [solCount] = await sql`SELECT count(*) FROM solicitacoes_alteracao WHERE status = 'em_analise'`
      const [usrCount] = await sql`SELECT count(*) FROM profiles WHERE role = 'solicitante'`
      pendingSolicitacoes = Number(solCount?.count ?? 0)
      pendingSolicitantes = Number(usrCount?.count ?? 0)
    }

    // 3. Atividades urgentes (próximos 7 dias)
    const urgentAtivRows = await sql`
      SELECT count(*) FROM atividades 
      WHERE responsavel_atividade_id = ${userId}
      AND status NOT IN ('resolvida', 'cancelada')
      AND data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
    `
    const urgentAtivCount = urgentAtivRows[0] ?? { count: 0 }
    const urgentEntregaRows = await sql`
      SELECT count(*) FROM entregas
      WHERE responsavel_entrega_id = ${userId}
      AND status NOT IN ('resolvida', 'cancelada')
      AND data_final_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
    `
    const urgentEntregaCount = urgentEntregaRows[0] ?? { count: 0 }
    
    // IDs de projetos urgentes para o link
    const urgentProjects = await sql`
      SELECT DISTINCT projeto_id FROM (
        SELECT e.projeto_id FROM atividades a JOIN entregas e ON a.entrega_id = e.id
        WHERE a.responsavel_atividade_id = ${userId} AND a.status NOT IN ('resolvida', 'cancelada')
        AND a.data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        UNION
        SELECT projeto_id FROM entregas
        WHERE responsavel_entrega_id = ${userId} AND status NOT IN ('resolvida', 'cancelada')
        AND data_final_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      ) sub
    `

    // 4. Alertas não lidos
    const alertas = await sql`
      SELECT id, tipo, entidade, entidade_nome, projeto_id, projeto_nome, descricao, created_at
      FROM alertas
      WHERE destinatario_id = ${userId} AND lido = false
      ORDER BY created_at DESC
    `

    // 5. Mensagens não lidas
    // Lógica complexa: se admin/master vê todas, senão vê apenas as destinadas ao setor
    let unreadMessages = 0
    if (userRole === 'admin' || userRole === 'master') {
      const msgRows = await sql`
        SELECT count(*) FROM mensagens_projeto m
        WHERE m.autor_id != ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM mensagem_leituras l 
          WHERE l.mensagem_id = m.id AND l.usuario_id = ${userId}
        )
      `
      unreadMessages = Number(msgRows[0]?.count ?? 0)
    } else if (userSetorId) {
      const msgRows = await sql`
        SELECT count(*) FROM mensagens_projeto m
        JOIN mensagem_destinatarios md ON m.id = md.mensagem_id
        WHERE md.setor_id = ${userSetorId}
        AND m.autor_id != ${userId}
        AND NOT EXISTS (
          SELECT 1 FROM mensagem_leituras l 
          WHERE l.mensagem_id = m.id AND l.usuario_id = ${userId}
        )
      `
      unreadMessages = Number(msgRows[0]?.count ?? 0)
    }

    return NextResponse.json({
      profile: {
        ...profile,
        setores: { codigo: profile.setor_codigo, nome_completo: profile.setor_nome }
      },
      stats: {
        pendingSolicitacoes,
        pendingSolicitantes,
        urgentActivities: Number(urgentAtivCount.count) + Number(urgentEntregaCount.count),
        urgentProjectIds: urgentProjects.map((p: any) => p.projeto_id),
        unreadMessages
      },
      alertas
    })

  } catch (error) {
    console.error('Layout Data API Error:', error)
    return NextResponse.json({ error: 'Erro ao carregar dados do layout' }, { status: 500 })
  }
}

