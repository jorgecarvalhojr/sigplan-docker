export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getResultadoSignedUrl } from '@/lib/resultados-storage'

// Rota estável de download. Verifica autenticação e redireciona para
// uma signed URL curta. Ao migrar para hospedagem institucional, esta
// rota passa a servir o arquivo por outro mecanismo sem quebrar links.
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')
    if (!path) {
      return NextResponse.json({ error: 'path obrigatório' }, { status: 400 })
    }
    // Só permite paths dentro dos prefixos esperados.
    if (!/^(entregas|atividades)\/\d+\/[a-f0-9-]+\.pdf$/i.test(path)) {
      return NextResponse.json({ error: 'path inválido' }, { status: 400 })
    }

    const url = await getResultadoSignedUrl(path, 60)
    return NextResponse.redirect(url)
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'

