import logger from '@/lib/logger'
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const projectIdsStr = request.nextUrl.searchParams.get('ids')
    if (!projectIdsStr) return NextResponse.json({ error: 'IDs não informados' }, { status: 400 })
    
    const projectIds = projectIdsStr.split(',').map(Number)

    // Esta query é complexa porque o generate-report-pdf precisa de muitos dados aninhados
    // Vamos buscar os projetos e depois montar o objeto
    const projetos = await sql`
      SELECT p.*, s.codigo AS setor_lider_codigo, s.nome_completo AS setor_lider_nome
      FROM projetos p
      JOIN setores s ON s.id = p.setor_lider_id
      WHERE p.id IN ${sql(projectIds)}
    `

    // Buscar ações dos projetos
    const projetoAcoes = await sql`
      SELECT pa.projeto_id, ae.numero, ae.nome
      FROM projeto_acoes pa
      JOIN acoes_estrategicas ae ON ae.id = pa.acao_estrategica_id
      WHERE pa.projeto_id IN ${sql(projectIds)}
    `

    // Buscar entregas e suas atividades/participantes
    const entregas = await sql`
      SELECT e.*, s.codigo as setor_codigo, s.nome_completo as setor_nome
      FROM entregas e
      LEFT JOIN setores s ON s.id = e.orgao_responsavel_setor_id
      WHERE e.projeto_id IN ${sql(projectIds)}
      ORDER BY e.data_inicio
    `

    const entregaIds = entregas.map((e: any) => e.id)
    
    const atividades = entregaIds.length > 0 ? await sql`
      SELECT a.*
      FROM atividades a
      WHERE a.entrega_id IN ${sql(entregaIds)}
      ORDER BY a.data_prevista
    ` : []

    const indicadores = await sql`SELECT * FROM indicadores WHERE projeto_id IN ${sql(projectIds)}`
    const riscos = await sql`SELECT * FROM riscos WHERE projeto_id IN ${sql(projectIds)}`

    // Buscar nomes de todos os perfis envolvidos para o Map de nomes
    const allProfiles = await sql`SELECT id, nome FROM profiles`
    const namesMap: Record<string, string> = {}
    allProfiles.forEach((p: any) => { namesMap[p.id] = p.nome })

    // Montar a estrutura que o PDF espera
    const result = projetos.map((p: any) => {
      const pAcoes = projetoAcoes.filter((pa: any) => pa.projeto_id === p.id).map((pa: any) => ({
        acao_estrategica: { numero: pa.numero, nome: pa.nome }
      }))

      const pEntregas = entregas.filter((e: any) => e.projeto_id === p.id).map((e: any) => {
        const eAtividades = atividades.filter((a: any) => a.entrega_id === e.id)
        return {
          ...e,
          setor_lider: e.setor_codigo ? { codigo: e.setor_codigo, nome_completo: e.setor_nome } : null,
          atividades: eAtividades
        }
      })

      return {
        ...p,
        setor_lider: { codigo: p.setor_lider_codigo, nome_completo: p.setor_lider_nome },
        projeto_acoes: pAcoes,
        entregas: pEntregas,
        indicadores: indicadores.filter((i: any) => i.projeto_id === p.id),
        riscos: riscos.filter((r: any) => r.projeto_id === p.id)
      }
    })

    return NextResponse.json({ projetos: result, namesMap })
  } catch (error: any) {
    logger.error('Full Project Data Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

