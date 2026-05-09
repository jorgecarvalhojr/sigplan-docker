export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'
import {
  uploadResultadoPDF,
  RESULTADOS_MAX_BYTES,
  RESULTADOS_ALLOWED_MIME,
  type ResultadoOwner,
} from '@/lib/resultados-storage'

// Permite upload do PDF comprobatório da entrega/atividade.
// Qualquer usuário autenticado (exceto 'solicitante') pode enviar.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const user = session.user

    // Verificar perfil via PostgreSQL Docker
    const [profile] = await sql`
      SELECT role, ativo FROM profiles WHERE id = ${user.id} LIMIT 1
    `
    if (!profile || !profile.ativo || profile.role === 'solicitante') {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const form = await request.formData()
    const file = form.get('file')
    const ownerKind = form.get('owner_kind')
    const ownerIdRaw = form.get('owner_id')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo ausente.' }, { status: 400 })
    }
    if (ownerKind !== 'entrega' && ownerKind !== 'atividade') {
      return NextResponse.json({ error: 'owner_kind inválido.' }, { status: 400 })
    }
    const ownerId = Number(ownerIdRaw)
    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      return NextResponse.json({ error: 'owner_id inválido.' }, { status: 400 })
    }

    if (file.type !== RESULTADOS_ALLOWED_MIME) {
      return NextResponse.json(
        { error: 'Apenas arquivos PDF são aceitos.' },
        { status: 400 }
      )
    }
    if (file.size > RESULTADOS_MAX_BYTES) {
      return NextResponse.json(
        { error: 'Tamanho máximo: 4 MB.' },
        { status: 400 }
      )
    }

    // Confirmar que a entidade existe no PostgreSQL Docker
    const table = ownerKind === 'entrega' ? 'entregas' : 'atividades'
    const [ent] = await sql`
      SELECT id FROM ${sql(table)} WHERE id = ${ownerId} LIMIT 1
    `
    if (!ent) {
      return NextResponse.json({ error: 'Entidade não encontrada.' }, { status: 404 })
    }

    const owner: ResultadoOwner =
      ownerKind === 'entrega'
        ? { kind: 'entrega', entregaId: ownerId }
        : { kind: 'atividade', atividadeId: ownerId }

    const meta = await uploadResultadoPDF(file, owner)
    return NextResponse.json(meta)
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const maxDuration = 30

