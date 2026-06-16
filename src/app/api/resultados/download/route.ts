export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getResultadoObjectData } from '@/lib/resultados-storage'

// Rota estável de download atuando como Proxy.
// Valida a autenticação, lê o arquivo do volume local do Docker
// e retorna via stream de bytes, sem expor caminho de disco.
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

    const fileData = await getResultadoObjectData(path)
    
    return new NextResponse(fileData.buffer, {
      status: 200,
      headers: {
        'Content-Type': fileData.contentType,
        'Content-Length': fileData.contentLength.toString(),
        'Content-Disposition': `inline; filename="${path.split('/').pop()}"`
      }
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao obter arquivo' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'

