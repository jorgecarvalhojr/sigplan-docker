import { NextResponse, type NextRequest } from 'next/server'
import { decrypt } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get('session')?.value
  const session = sessionToken ? await decrypt(sessionToken) : null
  const user = session?.user

  const { pathname } = request.nextUrl

  // 1. Rotas protegidas (Dashboard e Admin)
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2. Proteção contra perfil 'solicitante' (pendente de aprovação)
  if (user && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin'))) {
    if (user.role === 'solicitante') {
      return NextResponse.redirect(new URL('/pendente', request.url))
    }
  }

  // 3. Redirecionar usuários logados para fora da página de login
  if (user && pathname === '/login') {
    if (user.role === 'solicitante') {
      return NextResponse.redirect(new URL('/pendente', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 4. Redirecionar da página /pendente se já aprovado
  if (user && pathname === '/pendente') {
    if (user.role !== 'solicitante') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/login', '/pendente'],
}
