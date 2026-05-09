import { NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar tudo em paralelo para performance
    const [acoes, setores, eixos, oes, fichaSetores] = await Promise.all([
      sql`
        SELECT a.id, a.numero, a.nome,
               e.nome as eixo_nome,
               o.nome as oe_nome,
               es.nome as estrategia_nome
        FROM public.acoes_estrategicas a
        LEFT JOIN public.eixos_prioritarios e ON a.eixo_prioritario_id = e.id
        LEFT JOIN public.objetivos_estrategicos o ON a.objetivo_estrategico_id = o.id
        LEFT JOIN public.estrategias es ON a.estrategia_id = es.id
        WHERE a.visivel_enquadramento = true
      `,
      sql`SELECT codigo, nome_completo FROM public.setores ORDER BY codigo`,
      sql`SELECT codigo, nome FROM public.eixos_prioritarios ORDER BY codigo`,
      sql`SELECT codigo, nome FROM public.objetivos_estrategicos ORDER BY codigo`,
      sql`
        SELECT fs.setor_id, fs.tipo_participacao, f.acao_estrategica_id, s.codigo as setor_codigo
        FROM public.ficha_setores fs
        JOIN public.fichas f ON fs.ficha_id = f.id
        JOIN public.setores s ON fs.setor_id = s.id
      `
    ])

    return NextResponse.json({
      acoes,
      setores,
      eixos,
      oes,
      fichaSetores
    })
  } catch (error) {
    console.error('Dashboard Data Error:', error)
    return NextResponse.json({ error: 'Erro ao carregar dados do dashboard' }, { status: 500 })
  }
}
