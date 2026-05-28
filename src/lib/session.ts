import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function getSecretKey() {
  const sk = process.env.SESSION_SECRET
  if (!sk) throw new Error('SESSION_SECRET não definida. Configure a variável de ambiente.')
  return new TextEncoder().encode(sk)
}

const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
const key = isBuild ? new Uint8Array() : getSecretKey()

export type SessionPayload = {
  user: {
    id: string
    rg: string
    nome: string
    email: string
    role: string
    setor_id: number | null
  }
}

export async function encrypt(payload: SessionPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // Sessão de 1 dia
    .sign(key)
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    })
    return payload as SessionPayload
  } catch (error) {
    return null
  }
}

export async function getSession() {
  const session = cookies().get('session')?.value
  if (!session) return null
  return await decrypt(session)
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get('session')?.value
  if (!session) return NextResponse.next()

  // Refresh expiration
  const parsed = await decrypt(session)
  if (!parsed) return NextResponse.next()

  const res = NextResponse.next()
  res.cookies.set({
    name: 'session',
    value: await encrypt(parsed),
    httpOnly: true,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
    sameSite: 'lax',
    path: '/',
  })
  return res
}
