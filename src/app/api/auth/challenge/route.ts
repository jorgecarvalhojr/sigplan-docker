export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'

const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'secret-padrao-temporario')

export async function GET() {
  const num1 = Math.floor(Math.random() * 10) + 1
  const num2 = Math.floor(Math.random() * 10) + 1
  const result = num1 + num2

  // Cria um token curto que expira em 5 minutos contendo a resposta
  const challengeToken = await new SignJWT({ result })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret)

  return NextResponse.json({
    question: `Quanto é ${num1} + ${num2}?`,
    challengeToken
  })
}
