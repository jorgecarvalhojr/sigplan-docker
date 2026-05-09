export const dynamic = 'force-dynamic'
/**
 * GET /api/dados/acao/[numero]
 * Retorna dados completos de uma ação estratégica para a página /dashboard/acao/[numero]
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { numero: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    const [profile] = await sql`
      SELECT p.id, p.role, p.nome, p.setor_id, s.codigo AS setor_codigo, s.nome_completo AS setor_nome
      FROM profiles p LEFT JOIN setores s ON s.id = p.setor_id
      WHERE p.id = ${user.id} LIMIT 1
    `

    const numero = decodeURIComponent(params.numero)

    const [acaoRows, configRows] = await Promise.all([
      sql`
        SELECT ae.*, oe.codigo AS oe_codigo, oe.nome AS oe_nome
        FROM acoes_estrategicas ae
        LEFT JOIN objetivos_estrategicos oe ON oe.id = ae.objetivo_estrategico_id
        WHERE ae.numero = ${numero}
        LIMIT 1
      `,
      sql`SELECT chave, valor FROM configuracoes`,
    ])

    if (!acaoRows.length) return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 })
    const acao = acaoRows[0]
    const acaoId = acao.id

    const [destaques, panoramico, fichas, fundamentacao, observacoes] = await Promise.all([
      sql`
        SELECT d.*, json_agg(json_build_object(
          'id', dl.id, 'ordem', dl.ordem, 'tipo', dl.tipo, 'label', dl.label, 'conteudo', dl.conteudo
        ) ORDER BY dl.ordem) AS linhas
        FROM destaques_estrategicos d
        LEFT JOIN destaque_linhas dl ON dl.destaque_id = d.id
        WHERE d.acao_estrategica_id = ${acaoId}
        GROUP BY d.id
        LIMIT 1
      `,
      sql`
        SELECT pl.*, json_agg(json_build_object(
          'setor_id', ps.setor_id, 'tipo_participacao', ps.tipo_participacao,
          'setor_codigo', s.codigo
        )) AS setores_participantes
        FROM panoramico_linhas pl
        LEFT JOIN panoramico_setores ps ON ps.panoramico_linha_id = pl.id
        LEFT JOIN setores s ON s.id = ps.setor_id
        WHERE pl.acao_estrategica_id = ${acaoId}
        GROUP BY pl.id
        ORDER BY pl.ordem
      `,
      sql`
        SELECT f.*, json_agg(json_build_object(
          'setor_id', fs.setor_id, 'tipo_participacao', fs.tipo_participacao,
          'setor_codigo', s.codigo
        )) AS setores
        FROM fichas f
        LEFT JOIN ficha_setores fs ON fs.ficha_id = f.id
        LEFT JOIN setores s ON s.id = fs.setor_id
        WHERE f.acao_estrategica_id = ${acaoId}
        GROUP BY f.id
        ORDER BY f.ordem
      `,
      sql`
        SELECT fu.*, json_agg(fi.conteudo ORDER BY fi.ordem) AS itens
        FROM fundamentacoes fu
        LEFT JOIN fundamentacao_itens fi ON fi.fundamentacao_id = fu.id
        WHERE fu.acao_estrategica_id = ${acaoId}
        GROUP BY fu.id
        LIMIT 1
      `,
      sql`
        SELECT o.*, p.nome AS autor_nome_perfil, resp.nome AS respondido_por_nome
        FROM observacoes o
        LEFT JOIN profiles p ON p.id = o.autor_id
        LEFT JOIN profiles resp ON resp.id = o.respondido_por
        WHERE o.acao_estrategica_id = ${acaoId}
        ORDER BY o.created_at DESC
      `,
    ])

    const cfgMap: Record<string, string> = {}
    configRows.forEach((c: any) => { cfgMap[c.chave] = c.valor })

    return NextResponse.json({
      profile: profile ? {
        ...profile,
        setores: profile.setor_id ? { codigo: profile.setor_codigo, nome_completo: profile.setor_nome } : null,
      } : null,
      acao,
      destaque: destaques[0] ?? null,
      panoramico,
      fichas,
      fundamentacao: fundamentacao[0] ?? null,
      observacoes,
      configuracoes: cfgMap,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { numero: string } }
) {
  // POST: inserir observação
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const user = session.user

    const [profile] = await sql`SELECT id, nome, role, setor_id FROM profiles WHERE id = ${user.id} LIMIT 1`
    if (!profile || !['admin', 'master', 'gestor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const numero = decodeURIComponent(params.numero)
    const [acao] = await sql`SELECT id FROM acoes_estrategicas WHERE numero = ${numero} LIMIT 1`
    if (!acao) return NextResponse.json({ error: 'Ação não encontrada' }, { status: 404 })

    const [setor] = await sql`SELECT codigo FROM setores WHERE id = ${profile.setor_id} LIMIT 1`
    const body = await request.json()

    await sql`
      INSERT INTO observacoes (acao_estrategica_id, bloco, conteudo, autor_id, autor_nome, autor_setor, status)
      VALUES (${acao.id}, ${body.bloco}, ${body.conteudo}, ${user.id}, ${profile.nome}, ${setor?.codigo ?? null}, 'em_analise')
    `
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
