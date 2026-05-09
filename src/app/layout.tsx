import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SIGPLAN | SEDEC-RJ',
  description: 'Sistema de Governança e Planejamento — Secretaria de Estado de Defesa Civil do Rio de Janeiro',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SIGPLAN',
  },
}

export const viewport: Viewport = {
  themeColor: '#E97724',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}
