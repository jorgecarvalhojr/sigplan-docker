import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    // Verificar permissão via PostgreSQL Docker
    const [callerProfile] = await sql`
      SELECT role FROM profiles WHERE id = ${user.id} LIMIT 1
    `
    if (!callerProfile || !['admin', 'master'].includes(callerProfile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { userId } = await request.json()
    if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })

    // Contar dependências diretamente no PostgreSQL Docker
    const [counts] = await sql`
      SELECT
        (SELECT COUNT(*) FROM projetos WHERE responsavel_id = ${userId})::int          AS proj_count,
        (SELECT COUNT(*) FROM entregas WHERE responsavel_entrega_id = ${userId})::int  AS ent_count,
        (SELECT COUNT(*) FROM atividades WHERE responsavel_atividade_id = ${userId})::int AS ativ_count,
        (SELECT COUNT(*) FROM atividade_participantes WHERE user_id = ${userId})::int   AS participacoes_count,
        (SELECT COUNT(*) FROM observacoes WHERE autor_id = ${userId})::int             AS observacoes_count
    `

    const projetos = counts.proj_count ?? 0
    const entregas = counts.ent_count ?? 0
    const atividades = counts.ativ_count ?? 0
    const participacoes = counts.participacoes_count ?? 0
    const observacoes = counts.observacoes_count ?? 0

    // Bloquear exclusão se usuário tem responsabilidades
    if (projetos > 0 || entregas > 0 || atividades > 0) {
      const parts: string[] = []
      if (projetos > 0) parts.push(`${projetos} projeto(s)`)
      if (entregas > 0) parts.push(`${entregas} entrega(s)`)
      if (atividades > 0) parts.push(`${atividades} atividade(s)`)
      return NextResponse.json({
        error: `Usuário é responsável por ${parts.join(', ')} e não pode ser excluído.`,
        impact: { projetos, entregas, atividades, participacoes, observacoes },
      }, { status: 400 })
    }

    // Deletar profile do banco Docker
    await sql`DELETE FROM profiles WHERE id = ${userId}`

    return NextResponse.json({ success: true, impact: { participacoes, observacoes } })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
