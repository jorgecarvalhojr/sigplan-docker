'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, Settings, User, FileText, FolderKanban, CalendarDays, BarChart3, Bell, AlertCircle, ChevronDown, ChevronUp, X, BookOpen, MessageSquare, FileBarChart } from 'lucide-react'
import ManualModal from '@/components/ManualModal'
import PushNotificationManager from '@/components/PushNotificationManager'
import type { Profile } from '@/lib/types'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    pendingSolicitacoes: 0,
    pendingSolicitantes: 0,
    urgentActivities: 0,
    urgentProjectIds: [] as number[],
    unreadMessages: 0
  })
  const [alertas, setAlertas] = useState<any[]>([])
  const [alertasExpanded, setAlertasExpanded] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualTooltip, setManualTooltip] = useState(false)
  const [relatoriosOpen, setRelatoriosOpen] = useState(false)
  const relatoriosRef = useRef<HTMLDivElement>(null)

  const router = useRouter()
  const pathname = usePathname()

  async function loadData() {
    try {
      const res = await fetch('/api/auth/layout-data')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      const data = await res.json()
      if (data.profile) {
        setProfile(data.profile)
        setStats(data.stats)
        setAlertas(data.alertas)
        
        // Verificação de segurança: se ainda for solicitante, vai pra página pendente
        if (data.profile.role === 'solicitante' && !pathname.includes('/pendente')) {
          router.push('/pendente')
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    
    // Refresh periódico ou em foco
    const onFocus = () => loadData()
    const onSolicitacaoUpdate = () => loadData()
    window.addEventListener('focus', onFocus)
    window.addEventListener('solicitacao-updated', onSolicitacaoUpdate)
    
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('solicitacao-updated', onSolicitacaoUpdate)
    }
  }, [pathname])

  // Fechar dropdown de relatórios ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (relatoriosRef.current && !relatoriosRef.current.contains(e.target as Node)) {
        setRelatoriosOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Tooltip do manual
  useEffect(() => {
    if (!profile) return
    const key = `manual_tooltip_dismissed_${profile.id}`
    if (!localStorage.getItem(key)) {
      const t = setTimeout(() => setManualTooltip(true), 800)
      return () => clearTimeout(t)
    }
  }, [profile])

  function dismissManualTooltip() {
    if (!profile) return
    localStorage.setItem(`manual_tooltip_dismissed_${profile.id}`, '1')
    setManualTooltip(false)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  async function markAllAlertsRead() {
    try {
      await fetch('/api/auth/alertas/read-all', { method: 'POST' })
      setAlertas([])
      setAlertasExpanded(false)
    } catch (err) {
      console.error(err)
    }
  }

  async function markAlertRead(id: number) {
    try {
      await fetch(`/api/auth/alertas/${id}/read`, { method: 'POST' })
      setAlertas(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-sedec-500 font-medium">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-2">
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-3 shrink-0 hover:opacity-90">
              <img src="/logo-sedec.png" alt="SEDEC-RJ" className="h-10" />
              <div className="hidden lg:block border-l border-gray-600 pl-3">
                <span className="block leading-tight tracking-widest text-base font-extrabold">
                  <span className="text-gray-200">SIG</span><span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">PLAN</span>
                </span>
                <span className="text-[11px] text-gray-400">Sistema de Governança e Planejamento</span>
              </div>
            </button>

            <nav className="hidden md:flex items-center gap-0.5 ml-4 shrink-0">
              <button onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1 px-2 lg:px-3 py-1.5 rounded-md text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                <FileText size={14} /> <span className="hidden lg:inline">Enquadramentos</span><span className="lg:hidden">Enquad.</span>
              </button>
              <button onClick={() => router.push('/dashboard/projetos')}
                className="flex items-center gap-1 px-2 lg:px-3 py-1.5 rounded-md text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                <FolderKanban size={14} /> Projetos
              </button>
              <button onClick={() => router.push('/dashboard/calendario')}
                className="flex items-center gap-1 px-2 lg:px-3 py-1.5 rounded-md text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                <CalendarDays size={14} /> <span className="hidden lg:inline">Calendário</span><span className="lg:hidden">Calend.</span>
              </button>
              <button onClick={() => router.push('/dashboard/painel-gantt')}
                className="flex items-center gap-1 px-2 lg:px-3 py-1.5 rounded-md text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                <BarChart3 size={14} /> Gantt
              </button>
              {(profile?.role === 'admin' || profile?.role === 'master') && (
                <div className="relative" ref={relatoriosRef}>
                  <button
                    onClick={() => setRelatoriosOpen(o => !o)}
                    className="flex items-center gap-1 px-2 lg:px-3 py-1.5 rounded-md text-xs lg:text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors">
                    <FileBarChart size={14} />
                    <span className="hidden lg:inline">Relatórios</span>
                    <span className="lg:hidden">Relat.</span>
                    <ChevronDown size={12} className={`transition-transform ${relatoriosOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {relatoriosOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 min-w-[160px]">
                      <button
                        onClick={() => { setRelatoriosOpen(false); router.push('/dashboard/relatorios') }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors rounded-t-md">
                        <FileBarChart size={12} /> Relatório PDF
                      </button>
                      <button
                        onClick={() => { setRelatoriosOpen(false); router.push('/dashboard/relatorios/tabular') }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-colors rounded-b-md">
                        <FileBarChart size={12} /> Relatório Tabular
                      </button>
                    </div>
                  )}
                </div>
              )}
            </nav>

            <div className="flex items-center gap-2 lg:gap-3 ml-auto">
              {(profile?.role === 'admin' || profile?.role === 'master') && (
                <div className="flex items-center gap-2">
                  {stats.pendingSolicitantes > 0 && (
                    <button onClick={() => router.push('/admin?tab=usuarios')}
                      className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 text-xs transition-colors" title={`${stats.pendingSolicitantes} cadastro(s) pendente(s)`}>
                      <User size={14} />
                      <span className="hidden xl:inline">{stats.pendingSolicitantes} cadastro(s)</span>
                      <span className="xl:hidden bg-yellow-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{stats.pendingSolicitantes}</span>
                    </button>
                  )}
                  {stats.pendingSolicitacoes > 0 && (
                    <button onClick={() => router.push('/admin')}
                      className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-xs transition-colors animate-pulse" title={`${stats.pendingSolicitacoes} solicitação(ões)`}>
                      <Bell size={14} />
                      <span className="hidden xl:inline">{stats.pendingSolicitacoes} solic.</span>
                      <span className="xl:hidden bg-amber-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{stats.pendingSolicitacoes}</span>
                    </button>
                  )}
                  <button
                    onClick={() => router.push('/admin')}
                    className="flex items-center gap-1 text-gray-400 hover:text-orange-400 text-sm transition-colors"
                    title={profile?.role === 'master' ? 'Gestão' : 'Admin'}
                  >
                    <Settings size={15} />
                    <span className="hidden lg:inline text-xs">{profile?.role === 'master' ? 'Gestão' : 'Admin'}</span>
                  </button>
                </div>
              )}

              {stats.unreadMessages > 0 && (
                <button onClick={() => router.push('/dashboard/projetos')}
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors"
                  title={`${stats.unreadMessages} mensagem(ns) não lida(s)`}>
                  <MessageSquare size={14} />
                  <span className="hidden xl:inline">{stats.unreadMessages} msg</span>
                  <span className="xl:hidden bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{stats.unreadMessages}</span>
                </button>
              )}

              <PushNotificationManager />

              <button onClick={() => router.push('/dashboard/perfil')}
                className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity shrink-0" title="Meu Perfil">
                <User size={15} className="text-gray-400" />
                <div className="hidden lg:flex flex-col items-end leading-tight">
                  <span className="text-gray-300 text-xs truncate max-w-[100px]">{profile?.nome}</span>
                  {profile?.role !== 'admin' && (profile as any)?.setores?.codigo && (
                    <span className="text-[10px] text-gray-500">{(profile as any).setores.codigo}</span>
                  )}
                </div>
                <span className="text-[10px] lg:text-xs bg-orange-600 px-1.5 lg:px-2 py-0.5 rounded-full capitalize">{profile?.role}</span>
              </button>

              <div className="relative">
                <button
                  onClick={() => { dismissManualTooltip(); setManualOpen(true) }}
                  className="text-gray-400 hover:text-sedec-400 transition-colors"
                  title="Manual de Utilização"
                >
                  <BookOpen size={17} />
                </button>
                {manualTooltip && (
                  <div className="absolute right-0 top-8 z-[200] w-56 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="absolute -top-1.5 right-2 w-3 h-3 bg-sedec-600 rotate-45 rounded-sm" />
                    <div className="bg-sedec-600 text-white text-xs rounded-xl shadow-xl px-4 py-3 leading-relaxed">
                      <p className="font-semibold mb-1">📖 Manual disponível</p>
                      <p className="text-sedec-100">Consulte as instruções de uso do sistema aqui sempre que precisar.</p>
                      <button
                        onClick={e => { e.stopPropagation(); dismissManualTooltip() }}
                        className="mt-2 text-sedec-200 hover:text-white underline underline-offset-2 text-[11px]"
                      >
                        Entendi, não mostrar novamente
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button onClick={handleLogout} className="text-gray-400 hover:text-white transition-colors" title="Sair">
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </div>
        <div className="h-0.5 bg-gradient-to-r from-orange-500 via-orange-400 to-yellow-500" />
        <div className="md:hidden flex overflow-x-auto border-t border-gray-700">
          <button onClick={() => router.push('/dashboard')}
            className="min-w-fit flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5">
            <FileText size={13} /> Enquadramentos
          </button>
          <button onClick={() => router.push('/dashboard/projetos')}
            className="min-w-fit flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 border-l border-gray-700">
            <FolderKanban size={13} /> Projetos
          </button>
          <button onClick={() => router.push('/dashboard/calendario')}
            className="min-w-fit flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 border-l border-gray-700">
            <CalendarDays size={13} /> Calendário
          </button>
          <button onClick={() => router.push('/dashboard/painel-gantt')}
            className="min-w-fit flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 border-l border-gray-700">
            <BarChart3 size={13} /> Gantt
          </button>
          {(profile?.role === 'admin' || profile?.role === 'master') && (<>
            <button onClick={() => router.push('/dashboard/relatorios')}
              className="min-w-fit flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 border-l border-gray-700">
              <FileBarChart size={13} /> Rel. PDF
            </button>
            <button onClick={() => router.push('/dashboard/relatorios/tabular')}
              className="min-w-fit flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5 border-l border-gray-700">
              <FileBarChart size={13} /> Rel. Tabular
            </button>
          </>)}
        </div>
      </header>

      {stats.urgentActivities > 0 && (
        <div onClick={() => router.push(`/dashboard/projetos${stats.urgentProjectIds.length > 0 ? `?alerta=${stats.urgentProjectIds.join(',')}` : ''}`)}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2.5 flex items-center justify-center gap-2 text-sm shadow-inner cursor-pointer transition-colors z-40 relative">
          <AlertCircle size={18} className="animate-pulse shrink-0" />
          <span className="font-medium text-center">
            Atenção! Você é responsável por {stats.urgentActivities} item(ns) com prazo para os próximos 7 dias.
          </span>
        </div>
      )}

      {alertas.length > 0 && (() => {
        const grouped: Record<number, { projeto_nome: string; items: typeof alertas }> = {}
        for (const al of alertas) {
          const pid = al.projeto_id || 0
          if (!grouped[pid]) grouped[pid] = { projeto_nome: al.projeto_nome || 'Sem projeto', items: [] }
          grouped[pid].items.push(al)
        }
        return (
          <div className="bg-orange-500 text-white z-40 relative">
            <div
              className="px-4 py-2.5 flex items-center justify-center gap-2 text-sm cursor-pointer hover:bg-orange-600 transition-colors"
              onClick={() => setAlertasExpanded(!alertasExpanded)}
            >
              <AlertCircle size={18} className="shrink-0" />
              <span className="font-medium">
                {alertas.length} notificação{alertas.length > 1 ? 'ões' : ''} não lida{alertas.length > 1 ? 's' : ''}
              </span>
              {alertasExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <button
                onClick={async (e) => {
                  e.stopPropagation()
                  await markAllAlertsRead()
                }}
                className="ml-2 text-white/80 hover:text-white text-xs underline"
                title="Marcar todos como lidos"
              >
                Limpar tudo
              </button>
            </div>
            {alertasExpanded && (
              <div className="bg-orange-600/90 px-4 pb-3 max-h-64 overflow-y-auto">
                {Object.entries(grouped).map(([pid, group]) => (
                  <div key={pid} className="mb-2">
                    <button
                      onClick={() => router.push(`/dashboard/projetos/${pid}`)}
                      className="text-xs font-bold text-orange-100 hover:text-white hover:underline mb-1 block"
                    >
                      {group.projeto_nome}
                    </button>
                    {group.items.map((al) => (
                      <div key={al.id} className="flex items-start gap-2 text-xs text-orange-50 py-0.5 pl-3">
                        <span className="flex-1">{al.descricao}</span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            await markAlertRead(al.id)
                          }}
                          className="text-orange-200 hover:text-white shrink-0 mt-0.5"
                          title="Dispensar"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-sedec.png" alt="SEDEC-RJ" className="h-6 opacity-60" />
            <span className="text-xs text-gray-400">SIGPLAN — Secretaria de Estado de Defesa Civil do Rio de Janeiro</span>
          </div>
          <span className="text-xs text-gray-300">Desenvolvido por ICTDEC</span>
        </div>
      </footer>

      <ManualModal open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  )
}
