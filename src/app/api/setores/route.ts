import { NextResponse } from 'next/server'
import sql from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const setores = await sql`
      SELECT id, codigo, nome_completo 
      FROM public.setores 
      WHERE visivel_cadastro = true 
      ORDER BY nome_completo ASC
    `
    return NextResponse.json(setores)
  } catch (error) {
    console.error('Error fetching sectors:', error)
    return NextResponse.json({ error: 'Erro ao carregar setores' }, { status: 500 })
  }
}
