import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    
    const [profile] = await sql`SELECT role FROM profiles WHERE id = ${session.user.id} LIMIT 1`
    if (!profile || !['admin', 'master'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const acaoId = searchParams.get('acaoId')

    if (!acaoId) {
      const acoes = await sql`SELECT id, numero, nome FROM acoes_estrategicas ORDER BY numero`
      return NextResponse.json(acoes)
    }

    const id = parseInt(acaoId)
    const [full] = await sql`SELECT * FROM acoes_estrategicas WHERE id = ${id}`
    const [destaque] = await sql`SELECT * FROM destaques_estrategicos WHERE acao_estrategica_id = ${id}`
    let destaqueLinhas: any[] = []
    if (destaque) {
      destaqueLinhas = await sql`SELECT * FROM destaque_linhas WHERE destaque_id = ${destaque.id} ORDER BY ordem`
    }
    const panoramico = await sql`SELECT * FROM panoramico_linhas WHERE acao_estrategica_id = ${id} ORDER BY ordem`
    
    const panIds = panoramico.map((p: any) => p.id)
    let panSetores: any[] = []
    if (panIds.length > 0) {
      panSetores = await sql`SELECT * FROM panoramico_setores WHERE panoramico_linha_id IN (${sql.array(panIds)})`
    }

    const fichas = await sql`SELECT * FROM fichas WHERE acao_estrategica_id = ${id} ORDER BY ordem`
    const fichaIds = fichas.map((f: any) => f.id)
    let fichaSetores: any[] = []
    if (fichaIds.length > 0) {
      fichaSetores = await sql`SELECT * FROM ficha_setores WHERE ficha_id IN (${sql.array(fichaIds)})`
    }

    const [fundamentacao] = await sql`SELECT * FROM fundamentacoes WHERE acao_estrategica_id = ${id}`
    let fundItens: any[] = []
    if (fundamentacao) {
      fundItens = await sql`SELECT * FROM fundamentacao_itens WHERE fundamentacao_id = ${fundamentacao.id} ORDER BY ordem`
    }

    return NextResponse.json({
      acao: full,
      destaque,
      destaqueLinhas,
      panoramico,
      panSetores,
      fichas,
      fichaSetores,
      fundamentacao,
      fundItens
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const [profile] = await sql`SELECT role FROM profiles WHERE id = ${session.user.id} LIMIT 1`
    if (!profile || !['admin', 'master'].includes(profile.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const { action, payload } = body

    switch (action) {
      case 'update_acao_field': {
        await sql`UPDATE acoes_estrategicas SET ${sql(payload.field)} = ${payload.value} WHERE id = ${payload.id}`
        return NextResponse.json({ success: true })
      }
      case 'update_destaque_linha': {
        await sql`UPDATE destaque_linhas SET conteudo = ${payload.conteudo} WHERE id = ${payload.id}`
        return NextResponse.json({ success: true })
      }
      case 'update_panoramico_linha': {
        await sql`
          UPDATE panoramico_linhas SET
            setor_display = ${payload.setor_display},
            papel = ${payload.papel},
            sintese_contribuicao = ${payload.sintese_contribuicao},
            nao_faz = ${payload.nao_faz}
          WHERE id = ${payload.id}
        `
        return NextResponse.json({ success: true })
      }
      case 'add_panoramico_linha': {
        const [nova] = await sql`
          INSERT INTO panoramico_linhas (acao_estrategica_id, ordem, setor_display, papel, sintese_contribuicao, nao_faz)
          VALUES (${payload.acaoId}, ${payload.ordem}, ${payload.setor_display}, ${payload.papel}, ${payload.sintese_contribuicao}, ${payload.nao_faz})
          RETURNING *
        `
        return NextResponse.json(nova)
      }
      case 'delete_panoramico_linha': {
        await sql`DELETE FROM panoramico_setores WHERE panoramico_linha_id = ${payload.id}`
        await sql`DELETE FROM panoramico_linhas WHERE id = ${payload.id}`
        return NextResponse.json({ success: true })
      }
      case 'add_pan_setor': {
        const [nova] = await sql`
          INSERT INTO panoramico_setores (panoramico_linha_id, setor_id, tipo_participacao)
          VALUES (${payload.panLinhaId}, ${payload.setorId}, ${payload.tipo})
          RETURNING *
        `
        return NextResponse.json(nova)
      }
      case 'remove_pan_setor': {
        await sql`DELETE FROM panoramico_setores WHERE id = ${payload.id}`
        return NextResponse.json({ success: true })
      }
      // Fichas
      case 'update_ficha_field': {
        await sql`UPDATE fichas SET ${sql(payload.field)} = ${payload.value} WHERE id = ${payload.id}`
        return NextResponse.json({ success: true })
      }
      case 'update_ficha_meta': {
        await sql`
          UPDATE fichas SET
            titulo = ${payload.titulo},
            setor_display = ${payload.setor_display},
            papel = ${payload.papel}
          WHERE id = ${payload.id}
        `
        return NextResponse.json({ success: true })
      }
      case 'add_ficha': {
        const [nova] = await sql`
          INSERT INTO fichas (acao_estrategica_id, ordem, titulo, setor_display, papel, justificativa, contribuicao_esperada, nao_escopo, dependencias_criticas)
          VALUES (${payload.acaoId}, ${payload.ordem}, ${payload.titulo}, ${payload.setor_display}, ${payload.papel}, ${payload.justificativa}, ${sql.array(payload.contribuicao_esperada)}, ${sql.array(payload.nao_escopo)}, ${sql.array(payload.dependencias_criticas)})
          RETURNING *
        `
        return NextResponse.json(nova)
      }
      case 'delete_ficha': {
        await sql`DELETE FROM ficha_setores WHERE ficha_id = ${payload.id}`
        await sql`DELETE FROM fichas WHERE id = ${payload.id}`
        return NextResponse.json({ success: true })
      }
      case 'add_ficha_setor': {
        const [nova] = await sql`
          INSERT INTO ficha_setores (ficha_id, setor_id, tipo_participacao)
          VALUES (${payload.fichaId}, ${payload.setorId}, ${payload.tipo})
          RETURNING *
        `
        return NextResponse.json(nova)
      }
      case 'remove_ficha_setor': {
        await sql`DELETE FROM ficha_setores WHERE id = ${payload.id}`
        return NextResponse.json({ success: true })
      }
      // Fundamentação
      case 'update_fund_field': {
        await sql`UPDATE fundamentacoes SET ${sql(payload.field)} = ${payload.value} WHERE id = ${payload.id}`
        return NextResponse.json({ success: true })
      }
      case 'update_fund_item': {
        await sql`UPDATE fundamentacao_itens SET conteudo = ${payload.conteudo} WHERE id = ${payload.id}`
        return NextResponse.json({ success: true })
      }
      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
