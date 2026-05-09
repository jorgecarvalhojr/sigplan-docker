export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { mensagemId, marcarTodas, projetoId } = await request.json()

    if (marcarTodas && projetoId) {
      // Marcar todas do projeto como lidas (exceto as do próprio autor)
      await sql`
        INSERT INTO public.mensagem_leituras (mensagem_id, usuario_id)
        SELECT m.id, ${session.user.id}
        FROM public.mensagens_projeto m
        WHERE m.projeto_id = ${Number(projetoId)}
          AND m.autor_id <> ${session.user.id}
          AND NOT EXISTS (
            SELECT 1 FROM public.mensagem_leituras ml 
            WHERE ml.mensagem_id = m.id AND ml.usuario_id = ${session.user.id}
          )
        ON CONFLICT (mensagem_id, usuario_id) DO NOTHING
      `
    } else if (mensagemId) {
      await sql`
        INSERT INTO public.mensagem_leituras (mensagem_id, usuario_id)
        VALUES (${Number(mensagemId)}, ${session.user.id})
        ON CONFLICT (mensagem_id, usuario_id) DO NOTHING
      `
    } else {
      return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Messages Read Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

