export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { encrypt } from '@/lib/session'
import sql from '@/lib/db'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { rg, nome, email, setorId } = await request.json()

    // 1. Garantir que o RG tenha 7 dígitos (zeros à esquerda)
    const rgFormatado = rg.trim().padStart(7, '0')

    // 2. Verificar se o RG já existe (prevenção contra duplicidade acidental)
    // Nota: Como removemos a UNIQUE constraint no passo anterior, 
    // permitimos múltiplos perfis com o mesmo RG, mas desde que tenham e-mails diferentes.
    const [existing] = await sql`
      SELECT id FROM public.profiles WHERE rg = ${rgFormatado} AND email = ${email} LIMIT 1
    `

    if (existing) {
      return NextResponse.json(
        { error: 'Este perfil já está cadastrado com este e-mail.' },
        { status: 400 }
      )
    }

    // 3. Criar o novo perfil como 'solicitante'
    const newId = crypto.randomUUID()
    
    const [perfil] = await sql`
      INSERT INTO public.profiles (
        id, rg, nome, email, setor_id, role, ativo
      ) VALUES (
        ${newId}, ${rgFormatado}, ${nome}, ${email}, ${setorId}, 'solicitante', true
      )
      RETURNING id, role, setor_id, nome, email, rg
    `

    // 3. Criar a sessão JWT
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 dia
    const session = await encrypt({
      user: {
        id: perfil.id,
        rg: perfil.rg,
        nome: perfil.nome,
        email: perfil.email,
        role: perfil.role,
        setor_id: perfil.setor_id
      }
    })

    // 4. Definir o cookie
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
        nome: perfil.nome,
        role: perfil.role
      }
    })

  } catch (error) {
    console.error('Register Route Error:', error)
    return NextResponse.json(
      { error: 'Erro interno ao realizar cadastro' },
      { status: 500 }
    )
  }
}

