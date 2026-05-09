export const dynamic = 'force-dynamic'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  cookies().set('session', '', { expires: new Date(0), path: '/' })
  return NextResponse.json({ success: true })
}

