export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import legacyUsers from '@/lib/legacy-users.json'

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')?.toLowerCase()
  
  if (!email) {
    return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 })
  }

  const legacyData = (legacyUsers as Record<string, any>)[email]
  
  if (!legacyData) {
    return NextResponse.json({ found: false })
  }

  return NextResponse.json({
    found: true,
    nome: legacyData.nome,
    setor_id: legacyData.setor_id,
    role: legacyData.role
  })
}

