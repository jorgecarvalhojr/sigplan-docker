export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getSession } from '@/lib/session'

// GET: Listar mensagens de um projeto
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const projetoId = request.nextUrl.searchParams.get('projetoId')
    if (!projetoId) return NextResponse.json({ error: 'Projeto ID não informado' }, { status: 400 })

    // 1. Buscar mensagens
    const mensagens = await sql`
      SELECT m.id, m.projeto_id, m.autor_id, m.conteudo, m.created_at,
             p.nome AS autor_nome, s.codigo AS autor_setor_codigo,
             EXISTS(SELECT 1 FROM public.mensagem_leituras ml WHERE ml.mensagem_id = m.id AND ml.usuario_id = ${session.user.id}) AS lida_por_mim
      FROM public.mensagens_projeto m
      LEFT JOIN public.profiles p ON p.id = m.autor_id
      LEFT JOIN public.setores s ON s.id = p.setor_id
      WHERE m.projeto_id = ${Number(projetoId)}
      ORDER BY m.created_at ASC
    `

    if (mensagens.length === 0) return NextResponse.json([])

    // 2. Buscar destinatários de todas as mensagens retornadas
    const msgIds = mensagens.map((m: any) => m.id)
    const destinatarios = await sql`
      SELECT md.mensagem_id, md.setor_id, s.codigo, s.nome_completo
      FROM public.mensagem_destinatarios md
      JOIN public.setores s ON s.id = md.setor_id
      WHERE md.mensagem_id IN ${sql(msgIds)}
    `

    // 3. Formatar resposta
    const result = mensagens.map(m => ({
      ...m,
      destinatarios: destinatarios.filter(d => d.mensagem_id === m.id)
    }))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Messages GET Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST: Enviar nova mensagem
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { projetoId, conteudo, destinatarioIds } = await request.json()

    if (!projetoId || !conteudo || !destinatarioIds || destinatarioIds.length === 0) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // 1. Inserir mensagem
    const [msg] = await sql`
      INSERT INTO public.mensagens_projeto (projeto_id, autor_id, conteudo)
      VALUES (${Number(projetoId)}, ${session.user.id}, ${conteudo})
      RETURNING id, created_at
    `

    // 2. Inserir destinatários
    const destInserts = destinatarioIds.map((sid: number) => ({
      mensagem_id: msg.id,
      setor_id: sid
    }))

    await sql`
      INSERT INTO public.mensagem_destinatarios ${sql(destInserts)}
    `

    return NextResponse.json({ success: true, id: msg.id, created_at: msg.created_at })
  } catch (error: any) {
    console.error('Messages POST Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

