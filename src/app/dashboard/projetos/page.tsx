'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Filter, X, Search, FolderKanban, Clock, AlertTriangle, CheckCircle, CheckCircle2, XCircle, ChevronRight, Building2, Activity, ClipboardList, ChevronDown, ChevronUp, AlertCircle, Crown, Package, Wrench, Users, HelpCircle, Info, Pause, MessageSquare } from 'lucide-react'
import type { Profile } from '@/lib/types'
import UserAutocompleteSelect from '@/components/UserAutocompleteSelect'
import HelpTooltipModal, { type HelpType } from '@/components/HelpTooltipModal'

interface ProjetoCard {
  id: number
  codigo_sequencial: number | null
  nome: string
  descricao: string
  setor_lider_id: number
  setor_lider_codigo: string
  setor_lider_nome: string
  acoes: { numero: string; nome: string; oe_codigo: string }[]
  tipo_acao: string[]
  setores_participantes: string[]
  proxima_entrega: { nome: string; data: string } | null
  proxima_atividade: { nome: string; data: string } | null
  atividades_atrasadas: { nome: string; data: string }[]
  pontualidade: 'em_dia' | 'proximo' | 'atrasado'
  tem_atividades_atrasadas: boolean
  status: string
  status_projeto: 'em_andamento' | 'concluido' | 'cancelado' | 'hibernando'
  solicitacoes_pendentes: number
  responsavel_id: string | null
  responsaveis_entrega: string[]
  responsaveis_atividade: string[]
  participantes_atividade: string[]
  role_map: Record<string, { role: string; entidade_nome: string; deadline: string | null }[]>
  data_inicio: string | null
  created_at: string
  tie_entrega_inicio: string | null
  tie_atividade: string | null
  tie_entrega_final: string | null
  unread_messages: number
  recorrente: boolean
}

const PONT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  em_dia: { label: 'Em dia', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle },
  proximo: { label: 'Próximo do prazo', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300', icon: Clock },
  atrasado: { label: 'Atrasado', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', icon: AlertTriangle },
  concluido: { label: 'Concluído', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-300', icon: XCircle },
  hibernando: { label: 'Hibernando', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-300', icon: Pause },
}

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<ProjetoCard[]>([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const searchParams = useSearchParams()
  const alertaIds = useMemo(() => {
    const raw = searchParams.get('alerta')
    if (!raw) return new Set<number>()
    return new Set(raw.split(',').map(Number).filter(n => !isNaN(n) && n > 0))
  }, [searchParams])
  const alertaImpactoIds = useMemo(() => {
    const raw = searchParams.get('alerta_impacto')
    if (!raw) return new Set<number>()
    return new Set(raw.split(',').map(Number).filter(n => !isNaN(n) && n > 0))
  }, [searchParams])

  // Filters
  const [searchText, setSearchText] = useState('')
  const [oeFilter, setOeFilter] = useState('')
  const [acaoFilter, setAcaoFilter] = useState('')
  const [setorFilter, setSetorFilter] = useState('')
  const [tipoAcaoFilter, setTipoAcaoFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'concluidos' | 'hibernando'>('ativos')
  const [recorrenteFilter, setRecorrenteFilter] = useState<'todos' | 'recorrentes' | 'nao_recorrentes'>('todos')
  const [helpType, setHelpType] = useState<HelpType>(null)

  // Reference data
  const [oes, setOes] = useState<{ codigo: string; nome: string }[]>([])
  const [acoes, setAcoes] = useState<{ numero: string; nome: string; oe_codigo: string }[]>([])
  const [setores, setSetores] = useState<{ id: number; codigo: string; nome_completo: string }[]>([])
  const [eligibleUsers, setEligibleUsers] = useState<{ id: string; nome: string; setor_id: number | null; setor_codigo: string | null }[]>([])

  const router = useRouter()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)

    const sessionRes = await fetch('/api/auth/session')
    if (!sessionRes.ok) { router.push('/login'); setLoading(false); return }
    const session = await sessionRes.json()
    const user = session.user
    if (!user) { router.push('/login'); setLoading(false); return }
    
    // Set profile immediately from session as a fallback
    setProfile(user as any)

    // Dados via PostgreSQL Docker
    const res = await fetch('/api/dados/projetos')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()

    // If API returned a profile (though it shouldn't in current route), use it
    if (data.profile) setProfile(data.profile as any)
    if (data.objetivos) setOes(data.objetivos)
    if (data.acoes) setAcoes(data.acoes.map((a: any) => ({
      numero: a.numero, nome: a.nome, oe_codigo: a.oe_codigo || '',
    })))
    if (data.setores) setSetores(data.setores)
    if (data.projetos?.[0] !== undefined) {
      // usuarios com a interface esperada pelo componente
    }

    // Configs e Profile do contexto
    const ctxRes = await fetch('/api/dados/contexto')
    if (ctxRes.ok) {
      const ctx = await ctxRes.json()
      if (ctx.profile) setProfile(ctx.profile)
      if (ctx.configuracoes) setConfigs(ctx.configuracoes)
      if (ctx.usuarios) setEligibleUsers(ctx.usuarios.map((u: any) => ({
        id: u.id, nome: u.nome, setor_id: u.setor_id, setor_codigo: u.setor_codigo ?? null,
      })))
    }

    const setoresData = data.setores || []

    if (data.projetos) {
      const cards: ProjetoCard[] = data.projetos.map((p: any) => {
        const respEntregaSet = new Set<string>()
        const respAtividadeSet = new Set<string>()
        p.entregas?.forEach((e: any) => {
          if (e.responsavel_entrega_id) respEntregaSet.add(e.responsavel_entrega_id)
          e.atividades?.forEach((a: any) => {
            if (a.responsavel_atividade_id) respAtividadeSet.add(a.responsavel_atividade_id)
          })
        })

        // Collect atividade participant user IDs
        const partAtividadeSet = new Set<string>()
        p.entregas?.forEach((e: any) => {
          e.atividades?.forEach((a: any) => {
            a.atividade_participantes?.forEach((ap: any) => {
              if (ap.user_id) partAtividadeSet.add(ap.user_id)
            })
          })
        })

        // Build role details for all involved users
        type RoleDetail = { role: string; entidade_nome: string; deadline: string | null }
        const roleMap = new Map<string, RoleDetail[]>()
        const addRole = (uid: string, role: string, nome: string, deadline: string | null) => {
          if (!roleMap.has(uid)) roleMap.set(uid, [])
          roleMap.get(uid)!.push({ role, entidade_nome: nome, deadline })
        }
        if (p.responsavel_id) addRole(p.responsavel_id, 'Líder de projeto', '', null)
        p.entregas?.forEach((e: any) => {
          if (e.responsavel_entrega_id) addRole(e.responsavel_entrega_id, 'Resp. entrega', e.nome, e.data_final_prevista)
          e.atividades?.forEach((a: any) => {
            if (a.responsavel_atividade_id) addRole(a.responsavel_atividade_id, 'Resp. atividade', a.nome, a.data_prevista)
            a.atividade_participantes?.forEach((ap: any) => {
              if (ap.user_id) addRole(ap.user_id, 'Part. atividade', a.nome, a.data_prevista)
            })
          })
        })

        // Collect participante setores (unique)
        const setorSet = new Set<string>()
        p.entregas?.forEach((e: any) => {
          // Include orgao responsavel as a participating sector
          if (e.orgao_responsavel_setor_id) {
            const setorResp = setoresData?.find((st: any) => st.id === e.orgao_responsavel_setor_id)
            if (setorResp) setorSet.add(setorResp.codigo)
          }
          e.entrega_participantes?.forEach((ep: any) => {
            if (ep.tipo_participante === 'setor' && ep.setor) setorSet.add(ep.setor.codigo)
            else if (ep.tipo_participante === 'externo_subsegop') setorSet.add('Ext. SUBSEGOP')
            else if (ep.tipo_participante === 'externo_sedec') setorSet.add('Ext. SEDEC')
          })
          e.atividades?.forEach((a: any) => {
            a.atividade_participantes?.forEach((ap: any) => {
              if (ap.tipo_participante === 'setor' && ap.setor) setorSet.add(ap.setor.codigo)
              else if (ap.tipo_participante === 'externo_subsegop') setorSet.add('Ext. SUBSEGOP')
              else if (ap.tipo_participante === 'externo_sedec') setorSet.add('Ext. SEDEC')
            })
          })
        })

        // Calculate pontualidade (entregas)
        const now = new Date()
        now.setHours(0, 0, 0, 0)
        const quinzena = new Date(now)
        quinzena.setDate(quinzena.getDate() + 15)

        let pontualidade: 'em_dia' | 'proximo' | 'atrasado' = 'em_dia'
        const activeEntregas = (p.entregas || []).filter((e: any) =>
          e.status !== 'resolvida' && e.status !== 'cancelada' && e.data_final_prevista
        )

        const hasAtrasada = activeEntregas.some((e: any) => new Date(e.data_final_prevista) < now)
        const hasProxima = activeEntregas.some((e: any) => {
          const d = new Date(e.data_final_prevista)
          return d >= now && d <= quinzena
        })

        if (hasAtrasada) pontualidade = 'atrasado'
        else if (hasProxima) pontualidade = 'proximo'

        // Próxima entrega (com nome)
        let proximaEntrega: { nome: string; data: string } | null = null
        const futuras = activeEntregas
          .filter((e: any) => new Date(e.data_final_prevista) >= now)
          .sort((a: any, b: any) => new Date(a.data_final_prevista).getTime() - new Date(b.data_final_prevista).getTime())
        if (futuras.length > 0) proximaEntrega = { nome: futuras[0].nome, data: futuras[0].data_final_prevista }
        else if (activeEntregas.length > 0) {
          const sorted = [...activeEntregas].sort((a: any, b: any) =>
            new Date(b.data_final_prevista).getTime() - new Date(a.data_final_prevista).getTime())
          proximaEntrega = { nome: sorted[0].nome, data: sorted[0].data_final_prevista }
        }

        // Atividades: coletar todas de todas as entregas
        const todasAtividades: any[] = []
        p.entregas?.forEach((e: any) => {
          e.atividades?.forEach((a: any) => { todasAtividades.push(a) })
        })

        const activeAtividades = todasAtividades.filter((a: any) =>
          a.status !== 'resolvida' && a.status !== 'cancelada' && a.data_prevista
        )

        // Atividades atrasadas
        const ativAtrasadas = activeAtividades
          .filter((a: any) => new Date(a.data_prevista) < now)
          .sort((a: any, b: any) => new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime())
          .map((a: any) => ({ nome: a.nome, data: a.data_prevista }))

        // Próxima atividade
        let proximaAtividade: { nome: string; data: string } | null = null
        const ativFuturas = activeAtividades
          .filter((a: any) => new Date(a.data_prevista) >= now)
          .sort((a: any, b: any) => new Date(a.data_prevista).getTime() - new Date(b.data_prevista).getTime())
        if (ativFuturas.length > 0) proximaAtividade = { nome: ativFuturas[0].nome, data: ativFuturas[0].data_prevista }

        // Status do projeto & Desempates de datas
        const entregas = p.entregas || []
        
        let minEntregaInicio = null
        for (const e of entregas) {
          if (e.data_inicio && (!minEntregaInicio || e.data_inicio < minEntregaInicio)) minEntregaInicio = e.data_inicio
        }
        let minAtivData = null
        for (const a of todasAtividades) {
          if (a.data_prevista && (!minAtivData || a.data_prevista < minAtivData)) minAtivData = a.data_prevista
        }
        let minEntregaFim = null
        for (const e of entregas) {
          if (e.data_final_prevista && (!minEntregaFim || e.data_final_prevista < minEntregaFim)) minEntregaFim = e.data_final_prevista
        }

        let status_projeto: 'em_andamento' | 'concluido' | 'cancelado' | 'hibernando' = 'em_andamento'
        if (p.status === 'hibernando') {
          status_projeto = 'hibernando'
        } else if (entregas.length > 0) {
          if (entregas.every((e: any) => e.status === 'cancelada')) status_projeto = 'cancelado'
          else if (entregas.every((e: any) => e.status === 'resolvida' || e.status === 'cancelada') && entregas.some((e: any) => e.status === 'resolvida')) status_projeto = 'concluido'
        }

        return {
          id: p.id,
          codigo_sequencial: p.codigo_sequencial ?? null,
          nome: p.nome,
          descricao: p.descricao,
          setor_lider_id: p.setor_lider_id,
          setor_lider_codigo: p.setor_lider?.codigo || '',
          setor_lider_nome: p.setor_lider?.nome_completo || '',
          acoes: (p.projeto_acoes || []).map((pa: any) => ({
            numero: pa.acao_estrategica?.numero || '',
            nome: pa.acao_estrategica?.nome || '',
            oe_codigo: pa.acao_estrategica?.objetivo_estrategico?.codigo || '',
          })),
          tipo_acao: p.tipo_acao || [],
          setores_participantes: Array.from(setorSet),
          proxima_entrega: proximaEntrega,
          proxima_atividade: proximaAtividade,
          atividades_atrasadas: ativAtrasadas,
          pontualidade,
          tem_atividades_atrasadas: ativAtrasadas.length > 0,
          status: p.status || 'ativo',
          status_projeto,
          solicitacoes_pendentes: p.solicitacoes_pendentes || 0,
          responsavel_id: p.responsavel_id || null,
          responsaveis_entrega: Array.from(respEntregaSet),
          responsaveis_atividade: Array.from(respAtividadeSet),
          participantes_atividade: Array.from(partAtividadeSet),
          role_map: Object.fromEntries(roleMap),
          data_inicio: p.data_inicio || null,
          created_at: p.created_at,
          tie_entrega_inicio: minEntregaInicio,
          tie_atividade: minAtivData,
          tie_entrega_final: minEntregaFim,
          unread_messages: 0,
          recorrente: p.recorrente ?? false,
        }
      })

      // Mensagens não lidas (vem do servidor na resposta)
      data.projetos.forEach((p: any, i: number) => {
        if (cards[i]) cards[i].unread_messages = p.unread_messages || 0
      })

      setProjetos(cards)
    }

    setLoading(false)
  }

  // Filter acoes by selected OE
  const filteredAcoes = useMemo(() => {
    if (!oeFilter) return acoes
    return acoes.filter(a => a.oe_codigo === oeFilter)
  }, [acoes, oeFilter])

  const filteredEligibleUsers = useMemo(() => {
    if (!setorFilter) return eligibleUsers
    const setorObj = setores.find((s: any) => s.codigo === setorFilter)
    if (!setorObj) return eligibleUsers
    return eligibleUsers.filter(u => u.setor_id === setorObj.id)
  }, [eligibleUsers, setorFilter, setores])

  // When OE changes, reset acao filter
  useEffect(() => { setAcaoFilter('') }, [oeFilter])

  // Filtered projects
  const filtered = useMemo(() => {
    return projetos.filter(p => {
      if (searchText) {
        const s = searchText.toLowerCase()
        if (!p.nome.toLowerCase().includes(s) && !p.descricao.toLowerCase().includes(s)) return false
      }
      if (oeFilter) {
        if (!p.acoes.some(a => a.oe_codigo === oeFilter)) return false
      }
      if (acaoFilter) {
        if (!p.acoes.some(a => a.numero === acaoFilter)) return false
      }
      if (setorFilter) {
        const isLider = p.setor_lider_codigo === setorFilter
        const isParticipante = p.setores_participantes.includes(setorFilter)
        if (!isLider && !isParticipante) return false
      }
      if (tipoAcaoFilter) {
        if (!p.tipo_acao.includes(tipoAcaoFilter)) return false
      }
      if (responsavelFilter) {
        const isLider = p.responsavel_id === responsavelFilter
        const isRespEntrega = p.responsaveis_entrega.includes(responsavelFilter)
        const isRespAtividade = p.responsaveis_atividade.includes(responsavelFilter)
        const isPartAtividade = p.participantes_atividade.includes(responsavelFilter)
        if (!isLider && !isRespEntrega && !isRespAtividade && !isPartAtividade) return false
      }
      if (statusFilter === 'ativos') {
        if (p.status === 'hibernando') return false
        const entregas = p.status_projeto
        if (entregas === 'concluido' || entregas === 'cancelado') return false
      } else if (statusFilter === 'concluidos') {
        if (p.status === 'hibernando') return false
        if (p.status_projeto !== 'concluido' && p.status_projeto !== 'cancelado') return false
      } else if (statusFilter === 'hibernando') {
        if (p.status !== 'hibernando') return false
      }
      if (recorrenteFilter === 'recorrentes' && !p.recorrente) return false
      if (recorrenteFilter === 'nao_recorrentes' && p.recorrente) return false
      return true
    })
  }, [projetos, searchText, oeFilter, acaoFilter, setorFilter, tipoAcaoFilter, responsavelFilter, statusFilter, recorrenteFilter])

  const [groupBy, setGroupBy] = useState<'setor' | 'status'>('setor')
  const [viewMode, setViewMode] = useState<'normal' | 'compact'>('compact')
  const [subgroupByResponsavel, setSubgroupByResponsavel] = useState(true)

  // Mapa rápido id -> nome de usuário para renderizar headers de subgrupo
  const userLookup = useMemo(() => {
    const map: Record<string, { nome: string }> = {}
    eligibleUsers.forEach(u => { map[u.id] = { nome: u.nome } })
    return map
  }, [eligibleUsers])

  // Group projects by setor or status
  const STATUS_GROUP_LABELS: Record<string, { label: string; icon: any; color: string }> = {
    em_andamento: { label: 'Em andamento', icon: Clock, color: 'text-blue-600' },
    concluido: { label: 'Concluídos', icon: CheckCircle2, color: 'text-emerald-600' },
    cancelado: { label: 'Cancelados', icon: XCircle, color: 'text-gray-500' },
    hibernando: { label: 'Hibernando', icon: Pause, color: 'text-indigo-600' },
  }

  const grouped = useMemo(() => {
    const groups: Record<string, ProjetoCard[]> = {}
    const sorted = [...filtered].sort((a, b) => {
      // 1. Sort by project start_date (ascending), projects without start_date go to the end
      if (a.data_inicio && b.data_inicio) {
        if (a.data_inicio !== b.data_inicio) return a.data_inicio.localeCompare(b.data_inicio)
      } else if (a.data_inicio) {
        return -1
      } else if (b.data_inicio) {
        return 1
      }
      
      // If tied or both without start_date -> apply tie-breakers:
      const aVal = a.tie_entrega_inicio || a.tie_atividade || a.tie_entrega_final || a.created_at || '9999-12-31'
      const bVal = b.tie_entrega_inicio || b.tie_atividade || b.tie_entrega_final || b.created_at || '9999-12-31'
      return aVal.localeCompare(bVal)
    })

    if (groupBy === 'setor') {
      sorted.forEach(p => {
        const key = p.setor_lider_codigo
        if (!groups[key]) groups[key] = []
        groups[key].push(p)
      })
      return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    } else {
      // Group by status
      sorted.forEach(p => {
        const key = p.status_projeto
        if (!groups[key]) groups[key] = []
        groups[key].push(p)
      })
      // Within em_andamento, sort by pontualidade (atrasado first)
      if (groups['em_andamento']) {
        groups['em_andamento'].sort((a, b) => {
          const order: Record<string, number> = { atrasado: 0, proximo: 1, em_dia: 2 }
          const aOrder = order[a.pontualidade] ?? 2
          const bOrder = order[b.pontualidade] ?? 2
          if (aOrder !== bOrder) return aOrder - bOrder
          if (!a.proxima_entrega && !b.proxima_entrega) return 0
          if (!a.proxima_entrega) return 1
          if (!b.proxima_entrega) return -1
          return new Date(a.proxima_entrega.data).getTime() - new Date(b.proxima_entrega.data).getTime()
        })
      }
      const statusOrder = ['em_andamento', 'concluido', 'cancelado']
      return statusOrder.filter(s => groups[s]).map(s => [s, groups[s]] as [string, ProjetoCard[]])
    }
  }, [filtered, groupBy])

  const [showPaineis, setShowPaineis] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const hasFilters = !!(searchText || oeFilter || acaoFilter || setorFilter || tipoAcaoFilter || responsavelFilter)
  const canCreate = (
    profile?.role?.toLowerCase() === 'admin' || 
    profile?.role?.toLowerCase() === 'master' || 
    (profile?.role?.toLowerCase() === 'gestor' && String(configs['proj_permitir_cadastro']).trim().toLowerCase() !== 'false')
  )

  function formatQuinzena(dateStr: string | null) {
    if (!dateStr) return '—'
    const d = new Date(dateStr + 'T00:00:00')
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    const year = d.getFullYear().toString().slice(-2)
    const q = d.getDate() <= 15 ? '1ª' : '2ª'
    return `${month}/${year} – ${q} quinz.`
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('pt-BR')
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-pulse text-sedec-500">Carregando...</div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FolderKanban size={24} className="text-orange-500" /> Gestão de Projetos
            <button onClick={() => setHelpType('permissoes')} className="text-gray-400 hover:text-sedec-500" title="Regras de permissão"><HelpCircle size={18} /></button>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Projetos vinculados às Ações Estratégicas Prioritárias
            <span className="opacity-0 hover:opacity-100 text-[8px] ml-2 text-gray-300">
              Role: {profile?.role || 'null'} | Permitir: {String(configs['proj_permitir_cadastro'])}
            </span>
          </p>
        </div>
        {canCreate && (
          <button onClick={() => router.push('/dashboard/projetos/novo')}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus size={18} /> Novo projeto
          </button>
        )}
      </div>

      {/* Barra de ações: Painéis + Filtros + Agrupamento + Visualização */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setShowPaineis(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showPaineis ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <Activity size={14} /> Painéis {showPaineis ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <button onClick={() => setShowFilters(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showFilters || hasFilters ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
          <Filter size={14} /> Filtros {hasFilters && <span className="bg-white/30 text-[10px] px-1.5 rounded-full">ativos</span>} {showFilters ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap gap-1.5">
          {/* Seletor de agrupamento */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setGroupBy('setor')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${groupBy === 'setor' ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Building2 size={13} /> Órgão
            </button>
            <button onClick={() => setGroupBy('status')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${groupBy === 'status' ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Activity size={13} /> Status
            </button>
          </div>
          {groupBy === 'setor' && (
            <button
              type="button"
              onClick={() => setSubgroupByResponsavel(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                subgroupByResponsavel
                  ? 'bg-sedec-100 text-sedec-700 border-sedec-300'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
              title="Subagrupar cards por líder do projeto dentro de cada órgão">
              <Users size={13} /> Por líder
            </button>
          )}
          {/* Seletor de visualização */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setViewMode('normal')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'normal' ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Normal
            </button>
            <button onClick={() => setViewMode('compact')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode === 'compact' ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Compacto
            </button>
          </div>
          {/* Filtro por status */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setStatusFilter('ativos')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${statusFilter === 'ativos' ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Ativos
            </button>
            <button onClick={() => setStatusFilter('concluidos')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${statusFilter === 'concluidos' ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Concluídos
            </button>
            <button onClick={() => setStatusFilter('hibernando')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${statusFilter === 'hibernando' ? 'bg-sedec-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <Pause size={12} /> Hibernando
            </button>
          </div>
          {/* Filtro por recorrência */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['todos', 'recorrentes', 'nao_recorrentes'] as const).map(v => (
              <button key={v} onClick={() => setRecorrenteFilter(v)}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${recorrenteFilter === v ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {v === 'todos' ? 'Todos' : v === 'recorrentes' ? '↻ Recorrentes' : 'Não recorrentes'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Painéis consolidados */}
      {showPaineis && (
        <div className="space-y-4 mb-6">
          <div className="flex gap-3 overflow-x-auto pb-1">
            <div className="flex flex-col items-center justify-center px-4 py-3 rounded-xl bg-white border border-gray-200 min-w-[100px]">
              <span className="text-2xl font-bold text-sedec-600 leading-none">{projetos.length}</span>
              <span className="text-[11px] text-gray-500 mt-1 text-center leading-tight">Projetos</span>
            </div>
            {(() => {
              const emAndamento = projetos.filter(p => p.status_projeto === 'em_andamento')
              const atrasados = emAndamento.filter(p => p.pontualidade === 'atrasado').length
              const proximos = emAndamento.filter(p => p.pontualidade === 'proximo').length
              const emDia = emAndamento.filter(p => p.pontualidade === 'em_dia').length
              const comAtivAtrasadas = emAndamento.filter(p => p.tem_atividades_atrasadas).length
              const concluidos = projetos.filter(p => p.status_projeto === 'concluido').length
              const cancelados = projetos.filter(p => p.status_projeto === 'cancelado').length
              return <>
                {emDia > 0 && <div className="flex flex-col items-center justify-center px-4 py-3 rounded-xl bg-white border border-green-200 min-w-[100px]">
                  <span className="text-2xl font-bold text-green-600 leading-none">{emDia}</span>
                  <span className="text-[11px] text-gray-500 mt-1 text-center leading-tight">Em dia</span>
                </div>}
                {proximos > 0 && <div className="flex flex-col items-center justify-center px-4 py-3 rounded-xl bg-white border border-yellow-200 min-w-[100px]">
                  <span className="text-2xl font-bold text-yellow-600 leading-none">{proximos}</span>
                  <span className="text-[11px] text-gray-500 mt-1 text-center leading-tight">Próx. do prazo</span>
                </div>}
                {atrasados > 0 && <div className="flex flex-col items-center justify-center px-4 py-3 rounded-xl bg-red-50 border border-red-200 min-w-[100px]">
                  <span className="text-2xl font-bold text-red-600 leading-none">{atrasados}</span>
                  <span className="text-[11px] text-gray-500 mt-1 text-center leading-tight">Atrasados</span>
                </div>}
                {comAtivAtrasadas > 0 && <div className="flex flex-col items-center justify-center px-4 py-3 rounded-xl bg-white border border-red-200 min-w-[100px]">
                  <span className="text-2xl font-bold text-red-500 leading-none">{comAtivAtrasadas}</span>
                  <span className="text-[11px] text-gray-500 mt-1 text-center leading-tight">C/ ativ. atrasada</span>
                </div>}
                {concluidos > 0 && <div className="flex flex-col items-center justify-center px-4 py-3 rounded-xl bg-white border border-emerald-200 min-w-[100px]">
                  <span className="text-2xl font-bold text-emerald-600 leading-none">{concluidos}</span>
                  <span className="text-[11px] text-gray-500 mt-1 text-center leading-tight">Concluídos</span>
                </div>}
                {cancelados > 0 && <div className="flex flex-col items-center justify-center px-4 py-3 rounded-xl bg-white border border-gray-200 min-w-[100px]">
                  <span className="text-2xl font-bold text-gray-500 leading-none">{cancelados}</span>
                  <span className="text-[11px] text-gray-500 mt-1 text-center leading-tight">Cancelados</span>
                </div>}
              </>
            })()}
          </div>

          {/* Projetos por AE (Scrollable/Horizontal) */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Projetos por Ação Estratégica</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
              {acoes.map(ae => {
                const count = projetos.filter(p => p.acoes.some((pa: any) => pa.numero === ae.numero)).length
                if (count === 0) return null
                return (
                  <div key={ae.numero} className="flex flex-col flex-shrink-0 bg-white hover:bg-gray-50 border border-gray-200 hover:border-sedec-200 hover:shadow-sm transition-all rounded-xl min-w-[160px] max-w-[180px] overflow-hidden cursor-default" title={ae.nome}>
                    <div className="p-3 pb-2 flex-grow">
                      <div className="text-[10px] font-bold text-sedec-500 mb-1 uppercase tracking-wider">AE {ae.numero}</div>
                      <div className="text-xs text-gray-700 font-medium line-clamp-2 leading-snug">{ae.nome}</div>
                    </div>
                    <div className="bg-gray-50 border-t border-gray-100 px-3 py-2 flex items-center justify-between mt-auto">
                      <span className="text-[10px] text-gray-500 uppercase font-medium">Projetos</span>
                      <span className="text-lg font-bold text-sedec-600 leading-none">{count}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {/* Projetos por tipo de ação */}
          {(() => {
            const TIPOS = ['Prevenção', 'Mitigação', 'Preparação', 'Resposta', 'Recuperação', 'Gestão/Governança', 'Inovação', 'Integração']
            const relevantes = projetos.filter(p => p.status_projeto !== 'cancelado')
            return (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Projetos por tipo de ação</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {TIPOS.map(tipo => {
                    const projetosTipo = relevantes.filter(p => p.tipo_acao.includes(tipo) || (tipo === 'Integração' && p.tipo_acao.includes('Ação de Integração')))
                    const emAndamento = projetosTipo.filter(p => p.status_projeto === 'em_andamento').length
                    const concluidos = projetosTipo.filter(p => p.status_projeto === 'concluido').length
                    return (
                      <div key={tipo} className="rounded-lg border border-gray-100 p-3 text-center">
                        <span className="text-[11px] font-medium text-purple-600 block mb-2">{tipo}</span>
                        <div className="flex justify-center gap-3">
                          <div>
                            <span className="text-lg font-bold text-blue-600 block leading-none">{emAndamento}</span>
                            <span className="text-[9px] text-gray-400">em andam.</span>
                          </div>
                          <div>
                            <span className="text-lg font-bold text-green-600 block leading-none">{concluidos}</span>
                            <span className="text-[9px] text-gray-400">concluíd.</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Filtros */}
      {(showFilters || hasFilters) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <Filter size={16} /> Filtros
            {hasFilters && (
              <button onClick={() => { setSearchText(''); setOeFilter(''); setAcaoFilter(''); setSetorFilter(''); setTipoAcaoFilter(''); setResponsavelFilter('') }}
                className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <X size={14} /> Limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Buscar projeto..." value={searchText}
                onChange={e => setSearchText(e.target.value)} className="input-field pl-9" title="Busca por nome do projeto" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 cursor-help" title="Busca por nome do projeto"><Info size={12} /></span>
            </div>
            <div className="relative">
              <select value={oeFilter} onChange={e => setOeFilter(e.target.value)} className="input-field" title="Filtra projetos vinculados ao objetivo estratégico selecionado">
                <option value="">Todos os objetivos</option>
                {oes.map(o => <option key={o.codigo} value={o.codigo}>{o.codigo} — {o.nome.substring(0, 60)}</option>)}
              </select>
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 cursor-help pointer-events-none" title="Filtra projetos vinculados ao objetivo estratégico selecionado"><Info size={12} /></span>
            </div>
            <div className="relative">
              <select value={acaoFilter} onChange={e => setAcaoFilter(e.target.value)} className="input-field" title="Filtra projetos vinculados à ação estratégica selecionada (depende do filtro de objetivo)">
                <option value="">Todas as ações</option>
                {filteredAcoes.map(a => <option key={a.numero} value={a.numero}>AE {a.numero}</option>)}
              </select>
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 cursor-help pointer-events-none" title="Filtra projetos vinculados à ação estratégica selecionada (depende do filtro de objetivo)"><Info size={12} /></span>
            </div>
            <div className="relative">
              <select value={setorFilter} onChange={e => setSetorFilter(e.target.value)} className="input-field" title="Filtra por setor líder, setor responsável pela entrega ou setores participantes">
                <option value="">Todos os setores</option>
                {setores.map(s => <option key={s.codigo} value={s.codigo}>{s.codigo}</option>)}
              </select>
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 cursor-help pointer-events-none" title="Filtra por setor líder, setor responsável pela entrega ou setores participantes"><Info size={12} /></span>
            </div>
            <div className="relative">
              <select value={tipoAcaoFilter} onChange={e => setTipoAcaoFilter(e.target.value)} className="input-field" title="Filtra pelo tipo de ação estratégica vinculada ao projeto">
                <option value="">Todos os tipos de ação</option>
                {['Prevenção', 'Mitigação', 'Preparação', 'Resposta', 'Recuperação', 'Gestão/Governança', 'Inovação', 'Integração'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-300 cursor-help pointer-events-none" title="Filtra pelo tipo de ação estratégica vinculada ao projeto"><Info size={12} /></span>
            </div>
            <div className="relative" title="Filtra projetos onde o usuário é líder do projeto, responsável ou participante de entrega/atividade">
              <UserAutocompleteSelect
                value={responsavelFilter || null}
                onChange={val => setResponsavelFilter(val || '')}
                users={filteredEligibleUsers}
                placeholder="Responsável/Participante"
              />
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-4">{filtered.length} projeto(s){hasFilters ? ' filtrado(s)' : ''}</p>

      {grouped.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          {projetos.length === 0 ? 'Nenhum projeto cadastrado ainda.' : 'Nenhum projeto encontrado com os filtros aplicados.'}
        </div>
      )}

      {grouped.map(([groupKey, projs]) => {
        // Header content depends on groupBy mode
        const isSetor = groupBy === 'setor'
        const statusGroup = STATUS_GROUP_LABELS[groupKey]
        const StatusIcon = statusGroup?.icon

        // Counters for setor header (Task 9)
        const emAndamentoCount = projs.filter(p => p.status_projeto === 'em_andamento').length
        const concluidoCount = projs.filter(p => p.status_projeto === 'concluido').length
        const canceladoCount = projs.filter(p => p.status_projeto === 'cancelado').length

        return (
        <div key={groupKey} className="mb-8">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 pb-2 border-b border-gray-200 flex-wrap">
            {isSetor ? (
              <>
                <Building2 size={16} className="text-sedec-500" />
                <span>{groupKey} — {setores.find(s => s.codigo === groupKey)?.nome_completo || ''}</span>
                <span className="text-xs font-normal text-gray-400 ml-2">{projs.length} projeto{projs.length !== 1 ? 's' : ''}</span>
                {emAndamentoCount > 0 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">{emAndamentoCount} em andam.</span>
                )}
                {concluidoCount > 0 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">{concluidoCount} concluíd.</span>
                )}
                {canceladoCount > 0 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">{canceladoCount} cancelad.</span>
                )}
              </>
            ) : (
              <>
                {StatusIcon && <StatusIcon size={16} className={statusGroup.color} />}
                <span className={statusGroup?.color}>{statusGroup?.label || groupKey}</span>
                <span className="text-xs font-normal text-gray-400 ml-2">{projs.length} projeto{projs.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </h2>

          {/* Grid: normal ou compacto, com subgrupos por líder do projeto opcional */}
          {(() => {
            const subGroups: Array<[string, ProjetoCard[]]> = (isSetor && subgroupByResponsavel)
              ? (() => {
                  const sm: Record<string, ProjetoCard[]> = {}
                  projs.forEach(p => {
                    const k = p.responsavel_id || '__SEM__'
                    if (!sm[k]) sm[k] = []
                    sm[k].push(p)
                  })
                  return Object.entries(sm).sort(([ra], [rb]) => {
                    if (ra === '__SEM__') return 1
                    if (rb === '__SEM__') return -1
                    const na = userLookup[ra]?.nome || ''
                    const nb = userLookup[rb]?.nome || ''
                    return na.localeCompare(nb)
                  })
                })()
              : ([['__ALL__', projs]] as Array<[string, ProjetoCard[]]>)
            return subGroups.map(([respKey, subProjs]) => {
              const showSubHeader = respKey !== '__ALL__'
              const respNome = respKey === '__SEM__'
                ? 'Sem líder do projeto definido'
                : (userLookup[respKey]?.nome || 'Usuário removido')
              const subEmDia = subProjs.filter(p => p.status_projeto === 'em_andamento' && p.pontualidade === 'em_dia').length
              const subProximo = subProjs.filter(p => p.status_projeto === 'em_andamento' && p.pontualidade === 'proximo').length
              const subAtrasado = subProjs.filter(p => p.status_projeto === 'em_andamento' && p.pontualidade === 'atrasado').length
              return (
                <div key={`${groupKey}::${respKey}`} className={showSubHeader ? 'mb-5' : ''}>
                  {showSubHeader && (
                    <div className="mt-4 mb-2 flex items-center gap-2 flex-wrap pl-2 border-l-2 border-sedec-200 py-1">
                      <Crown size={12} className="text-sedec-400" />
                      <span className="text-xs font-semibold text-gray-700">{respNome}</span>
                      <span className="text-[10px] text-gray-400">{subProjs.length} projeto{subProjs.length !== 1 ? 's' : ''}</span>
                      {subEmDia > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">{subEmDia} em dia</span>}
                      {subProximo > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">{subProximo} próximo</span>}
                      {subAtrasado > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">{subAtrasado} atrasado{subAtrasado !== 1 ? 's' : ''}</span>}
                    </div>
                  )}
                  <div className={viewMode === 'compact'
                    ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 items-start'
                    : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start'
                  }>
                    {subProjs.map(p => {
              const pontKey = p.status_projeto !== 'em_andamento' ? p.status_projeto : p.pontualidade
              const pont = PONT_CONFIG[pontKey]
              const PontIcon = pont.icon
              const isAlerta = alertaIds.has(p.id)
              const isAlertaImpacto = alertaImpactoIds.has(p.id)

              if (viewMode === 'compact') {
                return (
                  <button key={p.id} onClick={() => router.push(`/dashboard/projetos/${p.id}`)}
                    className={`card p-3 text-left group hover:border-orange-300 hover:z-10 hover:shadow-lg transition-all relative ${pont.border} border-l-4 ${isAlerta ? 'ring-2 ring-red-400 ring-offset-1 bg-red-50/40' : isAlertaImpacto ? 'ring-2 ring-amber-400 ring-offset-1 bg-amber-50/40 animate-pulse' : p.recorrente ? 'ring-1 ring-purple-200' : ''}`}>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <h3 className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2 group-hover:line-clamp-none">
                        {p.codigo_sequencial != null && (
                          <span className="inline-block mr-1 px-1 py-0.5 rounded bg-orange-100 text-orange-700 text-[9px] font-bold align-middle">
                            SP-{String(p.codigo_sequencial).padStart(4, '0')}
                          </span>
                        )}
                        {p.recorrente && (
                          <span className="inline-flex items-center gap-0.5 mr-1 px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200 text-[9px] font-bold align-middle">↻ Recorrente</span>
                        )}
                        {p.nome}
                      </h3>
                      {isAlerta && (
                        <span className="shrink-0 flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
                          <AlertCircle size={9} /> Prazo
                        </span>
                      )}
                      {p.unread_messages > 0 && (
                        <span className="shrink-0 flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white animate-pulse">
                          <MessageSquare size={9} /> {p.unread_messages}
                        </span>
                      )}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${pont.bg} ${pont.color}`}>
                      <PontIcon size={9} /> {pont.label}
                    </span>
                    {/* Hover: detalhes expandidos */}
                    <div className="hidden group-hover:block mt-2 pt-2 border-t border-gray-100 space-y-1">
                      <p className="text-[10px] text-gray-500 line-clamp-3">{p.descricao}</p>
                      {p.proxima_entrega && (
                        <div className="flex items-start gap-1 text-[10px] text-gray-500">
                          <Clock size={10} className="mt-0.5 shrink-0" />
                          <span>Próx: <span className="font-medium">{p.proxima_entrega.nome}</span> — {formatQuinzena(p.proxima_entrega.data)}</span>
                        </div>
                      )}
                      {p.tem_atividades_atrasadas && (
                        <span className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                          <Activity size={9} /> {p.atividades_atrasadas.length} ativ. atrasada{p.atividades_atrasadas.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {responsavelFilter && p.role_map[responsavelFilter] && (
                        <div className="pt-1 border-t border-amber-200 space-y-0.5">
                          {p.role_map[responsavelFilter].slice(0, 2).map((r, ri) => (
                            <div key={ri} className="flex items-center gap-1 text-[9px] text-amber-700">
                              <span className="font-medium">{r.role}</span>
                              {r.entidade_nome && <span className="truncate text-amber-500" title={r.entidade_nome}>: {r.entidade_nome}</span>}
                            </div>
                          ))}
                          {p.role_map[responsavelFilter].length > 2 && (
                            <span className="text-[8px] text-amber-400">+{p.role_map[responsavelFilter].length - 2} mais</span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                )
              }

              // Normal view
              return (
                <button key={p.id} onClick={() => router.push(`/dashboard/projetos/${p.id}`)}
                  className={`card p-5 text-left group hover:border-orange-300 transition-colors ${pont.border} border-l-4 ${isAlerta ? 'ring-2 ring-red-400 ring-offset-1 bg-red-50/40' : isAlertaImpacto ? 'ring-2 ring-amber-400 ring-offset-1 bg-amber-50/40 animate-pulse' : p.recorrente ? 'ring-1 ring-purple-200' : ''}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-gray-800 leading-snug min-h-[2.5rem] line-clamp-2 group-hover:line-clamp-none">
                      {p.codigo_sequencial != null && (
                        <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold align-middle">
                          SP-{String(p.codigo_sequencial).padStart(4, '0')}
                        </span>
                      )}
                      {p.nome}
                    </h3>
                    <div className="flex flex-col gap-1 shrink-0 items-end">
                      {p.recorrente && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                          ↻ Recorrente
                        </span>
                      )}
                      {isAlerta && (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
                          <AlertCircle size={10} /> Prazo próximo
                        </span>
                      )}
                      <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${pont.bg} ${pont.color}`}>
                        <PontIcon size={11} /> {pont.label}
                      </span>
                      {p.tem_atividades_atrasadas && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          <Activity size={10} /> {p.atividades_atrasadas.length} ativ. atrasada{p.atividades_atrasadas.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {p.solicitacoes_pendentes > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          <ClipboardList size={10} /> {p.solicitacoes_pendentes} solicit.
                        </span>
                      )}
                      {p.unread_messages > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 animate-pulse">
                          <MessageSquare size={10} /> {p.unread_messages} msg não lida{p.unread_messages > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">{p.descricao}</p>

                  <div className="space-y-1.5 text-xs text-gray-500">
                    <div className="flex flex-wrap gap-1">
                      {p.acoes.map(a => (
                        <span key={a.numero} className="bg-sedec-50 text-sedec-600 px-1.5 py-0.5 rounded text-[10px] font-medium">
                          AE {a.numero}
                        </span>
                      ))}
                    </div>
                    {p.setores_participantes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.setores_participantes.slice(0, 5).map(s => (
                          <span key={s} className={`px-1.5 py-0.5 rounded text-[10px] ${
                            setorFilter && s === setorFilter ? 'bg-orange-100 text-orange-700 font-bold' : 'bg-gray-100 text-gray-500'
                          }`}>{s}</span>
                        ))}
                        {p.setores_participantes.length > 5 && (
                          <span className="text-[10px] text-gray-400">+{p.setores_participantes.length - 5}</span>
                        )}
                      </div>
                    )}

                    {/* Próxima entrega com nome */}
                    {p.proxima_entrega && (
                      <div className="flex items-start gap-1 text-[11px]">
                        <Clock size={11} className="text-gray-400 mt-0.5 shrink-0" />
                        <span>Próx. entrega: <span className="font-medium">{p.proxima_entrega.nome}</span> — {formatQuinzena(p.proxima_entrega.data)}</span>
                      </div>
                    )}

                    {/* Próxima atividade */}
                    {p.proxima_atividade && (
                      <div className="flex items-start gap-1 text-[11px]">
                        <Activity size={11} className="text-gray-400 mt-0.5 shrink-0" />
                        <span>Próx. atividade: <span className="font-medium">{p.proxima_atividade.nome}</span> — {formatDate(p.proxima_atividade.data)}</span>
                      </div>
                    )}

                    {/* Atividades atrasadas - expandem no hover */}
                    {p.atividades_atrasadas.length > 0 && (
                      <div className="hidden group-hover:block">
                        <div className="text-[10px] font-semibold text-red-600 mt-1 mb-0.5">Atividades atrasadas:</div>
                        {p.atividades_atrasadas.slice(0, 5).map((aa, i) => (
                          <div key={i} className="text-[10px] text-red-500 pl-2">• {aa.nome} — {formatDate(aa.data)}</div>
                        ))}
                        {p.atividades_atrasadas.length > 5 && (
                          <div className="text-[10px] text-red-400 pl-2">+{p.atividades_atrasadas.length - 5} mais</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Papéis do usuário filtrado */}
                  {responsavelFilter && p.role_map[responsavelFilter] && (
                    <div className="mt-2 pt-2 border-t border-amber-200 bg-amber-50/80 -mx-5 px-5 pb-1 space-y-0.5">
                      {p.role_map[responsavelFilter].map((r, ri) => (
                        <div key={ri} className="flex items-center gap-1.5 text-[10px] text-amber-800">
                          {r.role === 'Líder de projeto' && <Crown size={10} className="shrink-0 text-amber-600" />}
                          {r.role === 'Resp. entrega' && <Package size={10} className="shrink-0 text-amber-600" />}
                          {r.role === 'Resp. atividade' && <Wrench size={10} className="shrink-0 text-amber-600" />}
                          {r.role === 'Part. atividade' && <Users size={10} className="shrink-0 text-amber-600" />}
                          <span className="font-medium">{r.role}</span>
                          {r.entidade_nome && (
                            <>
                              <span className="text-amber-500">—</span>
                              <span className="truncate" title={r.entidade_nome}>{r.entidade_nome}</span>
                            </>
                          )}
                          {r.deadline && <span className="text-amber-500 shrink-0 ml-auto">{r.deadline.split('-').reverse().join('/')}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center text-xs text-orange-600 font-medium group-hover:text-orange-700">
                    Ver detalhes <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              )
                    })}
                  </div>
                </div>
              )
            })
          })()}
        </div>
        )
      })}
      <HelpTooltipModal type={helpType} onClose={() => setHelpType(null)} userRole={profile?.role} />
    </div>
  )
}
