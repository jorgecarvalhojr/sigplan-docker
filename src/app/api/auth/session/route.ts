export const dynamic = 'force-dynamic'
import { getSession } from '@/lib/session'
import { NextResponse } from 'next/server'

export async function GET() {
  console.log('[API Session] Checking session...')
  const session = await getSession()
  if (!session) {
    console.log('[API Session] No session found.')
    return NextResponse.json({ user: null }, { status: 401 })
  }
  console.log(`[API Session] Session found for user: ${session.user.id}`)
  return NextResponse.json(session)
}

