export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarCbmerj } from '@/lib/cbmerj-auth'
import { encrypt } from '@/lib/session'
import sql from '@/lib/db'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { rg, password, selectedProfileId, challengeAnswer, challengeToken, website } = await request.json()

    if (!rg || !password) {
      return NextResponse.json(
        { error: 'RG e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // 0. Proteção Anti-Bot
    if (!selectedProfileId) {
      // Honeypot: Se o campo 'website' estiver preenchido, é um bot
      if (website) {
        console.warn('🤖 Bot detectado via honeypot')
        return NextResponse.json({ error: 'Atividade suspeita detectada' }, { status: 403 })
      }

      // Desafio Matemático
      if (!challengeAnswer || !challengeToken) {
        return NextResponse.json({ error: 'Desafio anti-robô obrigatório' }, { status: 400 })
      }

      try {
        const { jwtVerify } = await import('jose')
        const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'secret-padrao-temporario')
        const { payload }: any = await jwtVerify(challengeToken, secret)
        
        if (Number(challengeAnswer) !== payload.result) {
          return NextResponse.json({ error: 'Resposta do desafio incorreta' }, { status: 400 })
        }
      } catch (err) {
        return NextResponse.json({ error: 'Desafio expirado ou inválido' }, { status: 400 })
      }
    }

    // 1. Autenticar no CBMERJ
    const dadosMilitar = await autenticarCbmerj(rg, password)

    if (!dadosMilitar) {
      return NextResponse.json(
        { error: 'RG ou senha inválidos' },
        { status: 401 }
      )
    }

    // 2. Buscar o(s) perfil(is) no banco local pelo RG
    console.log(`🔍 Buscando perfis locais para RG: "${dadosMilitar.rg}"`)
    const perfis = await sql`
      SELECT p.id, p.role, p.setor_id, p.nome, p.email, p.rg, s.codigo as setor_codigo, s.nome_completo as setor_nome
      FROM public.profiles p
      LEFT JOIN public.setores s ON p.setor_id = s.id
      WHERE p.rg = ${dadosMilitar.rg}
    `
    console.log(`📊 Encontrados ${perfis.length} perfis.`)
    if (perfis.length > 0) {
      console.log('👤 Perfis encontrados:', JSON.stringify(perfis, null, 2))
    }

    if (perfis.length === 0) {
      // Em vez de erro 403, retornamos que o cadastro é necessário
      // enviando os dados já validados pela API do CBMERJ
      return NextResponse.json({
        success: true,
        requiresRegistration: true,
        rg: dadosMilitar.rg,
        nome: dadosMilitar.nome
      })
    }

    // 3. Checar se tem mais de um perfil e se o usuário já selecionou algum
    let perfilToLogin = perfis[0];

    if (perfis.length > 1) {
      if (!selectedProfileId) {
        // Retorna a lista de perfis para o front-end exibir a seleção
        return NextResponse.json({
          success: true,
          requiresProfileSelection: true,
          profiles: perfis.map((p: any) => ({
            id: p.id,
            email: p.email,
            setor_codigo: p.setor_codigo,
            setor_nome: p.setor_nome
          }))
        })
      } else {
        // Se já escolheu um perfil, pega ele
        const selected = perfis.find((p: any) => p.id === selectedProfileId);
        if (!selected) {
          return NextResponse.json({ error: 'Perfil selecionado inválido.' }, { status: 400 })
        }
        perfilToLogin = selected;
      }
    }

    // 4. Criar a sessão JWT
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 dia
    const session = await encrypt({
      user: {
        id: perfilToLogin.id,
        rg: perfilToLogin.rg,
        nome: perfilToLogin.nome,
        email: perfilToLogin.email,
        role: perfilToLogin.role,
        setor_id: perfilToLogin.setor_id
      }
    })

    // 5. Definir o cookie e retornar
    cookies().set('session', session, {
      expires,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    })

    return NextResponse.json({
      success: true,
      user: {
        nome: perfilToLogin.nome,
        role: perfilToLogin.role
      }
    })

  } catch (error) {
    console.error('Login Route Error:', error)
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    )
  }
}

