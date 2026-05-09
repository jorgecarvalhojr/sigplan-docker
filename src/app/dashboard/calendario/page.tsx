'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronLeft, ChevronRight, Filter, X, ExternalLink, Edit3, Save, Plus, Trash2, Loader2 } from 'lucide-react'
import type { Profile } from '@/lib/types'
import UserAutocompleteSelect from '@/components/UserAutocompleteSelect'
import RegisterGestorModal from '@/components/RegisterGestorModal'

interface CalendarItem {
  id: number
  tipo: 'entrega' | 'atividade'
  nome: string
  entrega_nome: string | null // only for atividade
  data: string // YYYY-MM-DD
  status: string
  motivo_status: string | null
  criterios_aceite: string | null // only for entrega
  dependencias_criticas: string | null // only for entrega
  projeto_id: number
  projeto_nome: string
  setores: string[]
  acoes: { numero: string; oe_codigo: string }[]
  // Campos para edição de datas e exibição
  setor_lider_id: number
  setor_lider_codigo: string
  setor_lider_nome: string
  entrega_id: number | null // para atividades: ID da entrega pai
  entrega_data_final: string | null // para atividades: data limite da entrega
  atividades_datas: { nome: string; data: string }[] // para entregas: datas das atividades filhas
  responsavel_id: string | null // responsável pela entrega ou atividade
  orgao_responsavel_setor_id: number | null // setor responsável pela entrega
  responsavel_atividade_id: string | null // responsável pela atividade (para nível 5)
  projeto_responsavel_id: string | null // líder do projeto
  responsavel_entrega_id: string | null // responsável pela entrega
  participante_user_ids: string[] // user_ids dos participantes de atividades
}

const STATUS_COLORS: Record<string, string> = {
  aberta: 'bg-gray-100 text-gray-700',
  em_andamento: 'bg-blue-100 text-blue-700',
  aguardando: 'bg-yellow-100 text-yellow-700',
  resolvida: 'bg-green-100 text-green-700',
  cancelada: 'bg-red-100 text-red-700',
}

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  // Monday=0 ... Sunday=6
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const days: { date: Date; isCurrentMonth: boolean }[] = []

  // Days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    days.push({ date: d, isCurrentMonth: false })
  }

  // Days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true })
  }

  // Fill remaining to complete weeks
  while (days.length % 7 !== 0) {
    const next = new Date(year, month + 1, days.length - startDow - lastDay.getDate() + 1)
    days.push({ date: next, isCurrentMonth: false })
  }

  return days
}

function getWeekDays(weekStart: Date) {
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    days.push(d)
  }
  return days
}

function getMondayOfWeek(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const QUINZENAS = (() => {
  const opts: { value: string; label: string }[] = []
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  for (let y = 2026; y <= 2027; y++) {
    for (let m = 0; m < 12; m++) {
      for (const q of [1, 2]) {
        const day = q === 1 ? 15 : new Date(y, m + 1, 0).getDate()
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        opts.push({ value: dateStr, label: `${meses[m]}/${String(y).slice(-2)} – ${q}ª quinzena` })
      }
    }
  }
  return opts
})()

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const STATUS_ATIVIDADE: Record<string, { label: string }> = {
  aberta: { label: 'Aberta' },
  em_andamento: { label: 'Em andamento' },
  aguardando: { label: 'Aguardando' },
  resolvida: { label: 'Resolvida' },
  cancelada: { label: 'Cancelada' },
}

export default function CalendarioPage() {
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'mes' | 'semana'>('mes')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [currentWeekStart, setCurrentWeekStart] = useState(getMondayOfWeek(today))

  const [oeFilter, setOeFilter] = useState('')
  const [acaoFilter, setAcaoFilter] = useState('')
  const [setorFilter, setSetorFilter] = useState('')
  const [projetoFilter, setProjetoFilter] = useState('')
  const [responsavelFilter, setResponsavelFilter] = useState('')
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)

  // Reference data
  const [oes, setOes] = useState<{ codigo: string; nome: string }[]>([])
  const [acoes, setAcoes] = useState<{ numero: string; nome: string; oe_codigo: string }[]>([])
  const [setores, setSetores] = useState<{ id: number; codigo: string; nome_completo: string }[]>([])
  const [eligibleUsers, setEligibleUsers] = useState<{ id: string; nome: string }[]>([])

  // Auth, configs, solicitações
  const [profile, setProfile] = useState<Profile | null>(null)
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])

  // Raw project data for create modal
  const [rawProjetos, setRawProjetos] = useState<any[]>([])

  // Create activity modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createDate, setCreateDate] = useState('')
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1)
  const [createProjetoId, setCreateProjetoId] = useState<number | null>(null)
  const [createEntregaId, setCreateEntregaId] = useState<number | null>(null)
  const [createForm, setCreateForm] = useState({
    nome: '', descricao: '', status: 'aberta', motivo_status: '',
    responsavel_atividade_id: '', participantes: [] as any[]
  })
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const [showGestorModal, setShowGestorModal] = useState(false)

  // Date editing
  const [editingDate, setEditingDate] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [savingDate, setSavingDate] = useState(false)

  const router = useRouter()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)

    const sessionRes = await fetch('/api/auth/session')
    if (sessionRes.ok) {
      const session = await sessionRes.json()
      if (session.user) {
        setProfile(session.user as any)
      }
    }

    // Dados via PostgreSQL Docker
    const res = await fetch('/api/dados/calendario')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()

    if (data.objetivos) setOes(data.objetivos)
    if (data.acoes) setAcoes(data.acoes.map((a: any) => ({
      numero: a.numero, nome: a.nome, oe_codigo: a.oe_codigo || '',
    })))
    if (data.setores) setSetores(data.setores)
    if (data.usuarios) setEligibleUsers(data.usuarios)
    if (data.solicitacoes) setSolicitacoes(data.solicitacoes)
    if (data.configuracoes) setConfigs(data.configuracoes)

    if (data.projetos) {
      setRawProjetos(data.projetos)
      const calItems: CalendarItem[] = []

      data.projetos.forEach((p: any) => {
        const projetoAcoes = (p.projeto_acoes || []).map((pa: any) => ({
          numero: pa.acao_estrategica?.numero || pa.numero || '',
          oe_codigo: pa.acao_estrategica?.objetivo_estrategico?.codigo || pa.oe_codigo || '',
        }))

        ;(p.entregas || []).forEach((e: any) => {
          const setorSet = new Set<string>()
          if (p.setor_lider?.codigo) setorSet.add(p.setor_lider.codigo)
          e.entrega_participantes?.forEach((ep: any) => {
            if (ep.tipo_participante === 'setor' && ep.setor) setorSet.add(ep.setor.codigo)
            else if (ep.tipo_participante === 'externo_subsegop') setorSet.add('Ext. SUBSEGOP')
            else if (ep.tipo_participante === 'externo_sedec') setorSet.add('Ext. SEDEC')
          })

          const ativDatas = (e.atividades || [])
            .filter((a: any) => a.data_prevista)
            .map((a: any) => ({ nome: a.nome, data: a.data_prevista }))

          if (e.data_final_prevista) {
            calItems.push({
              id: e.id, tipo: 'entrega', nome: e.nome, entrega_nome: null,
              data: e.data_final_prevista,
              status: e.status || 'aberta', motivo_status: e.motivo_status || null,
              criterios_aceite: e.criterios_aceite || null, dependencias_criticas: e.dependencias_criticas || null,
              projeto_id: p.id, projeto_nome: p.nome,
              setores: Array.from(setorSet), acoes: projetoAcoes,
              setor_lider_id: p.setor_lider_id,
              setor_lider_codigo: p.setor_lider?.codigo || '',
              setor_lider_nome: p.setor_lider?.nome_completo || '',
              entrega_id: null, entrega_data_final: null, atividades_datas: ativDatas,
              responsavel_id: e.responsavel_entrega_id || null,
              orgao_responsavel_setor_id: e.orgao_responsavel_setor_id || null,
              responsavel_atividade_id: null,
              projeto_responsavel_id: p.responsavel_id || null,
              responsavel_entrega_id: e.responsavel_entrega_id || null,
              participante_user_ids: (e.atividades || []).flatMap((a: any) =>
                (a.atividade_participantes || []).filter((ap: any) => ap.user_id).map((ap: any) => ap.user_id)
              ),
            })
          }

          ;(e.atividades || []).forEach((a: any) => {
            const aSetorSet = new Set<string>(setorSet)
            a.atividade_participantes?.forEach((ap: any) => {
              if (ap.tipo_participante === 'setor' && ap.setor) aSetorSet.add(ap.setor.codigo)
              else if (ap.tipo_participante === 'externo_subsegop') aSetorSet.add('Ext. SUBSEGOP')
              else if (ap.tipo_participante === 'externo_sedec') aSetorSet.add('Ext. SEDEC')
            })
            if (a.data_prevista) {
              calItems.push({
                id: a.id, tipo: 'atividade', nome: a.nome, entrega_nome: e.nome,
                data: a.data_prevista,
                status: a.status || 'aberta', motivo_status: a.motivo_status || null,
                criterios_aceite: null, dependencias_criticas: null,
                projeto_id: p.id, projeto_nome: p.nome,
                setores: Array.from(aSetorSet), acoes: projetoAcoes,
                setor_lider_id: p.setor_lider_id,
                setor_lider_codigo: p.setor_lider?.codigo || '',
                setor_lider_nome: p.setor_lider?.nome_completo || '',
                entrega_id: e.id, entrega_data_final: e.data_final_prevista || null,
                atividades_datas: [],
                responsavel_id: a.responsavel_atividade_id || null,
                orgao_responsavel_setor_id: e.orgao_responsavel_setor_id || null,
                responsavel_atividade_id: a.responsavel_atividade_id || null,
                projeto_responsavel_id: p.responsavel_id || null,
                responsavel_entrega_id: e.responsavel_entrega_id || null,
                participante_user_ids: (a.atividade_participantes || []).filter((ap: any) => ap.user_id).map((ap: any) => ap.user_id),
              })
            }
          })
        })
      })
      setItems(calItems)
    }
    setLoading(false)
  }

  // Filter acoes by selected OE
  const filteredAcoes = useMemo(() => {
    if (!oeFilter) return acoes
    return acoes.filter(a => a.oe_codigo === oeFilter)
  }, [acoes, oeFilter])

  useEffect(() => { setAcaoFilter('') }, [oeFilter])

  // Derive unique projects from items, filtered by selected sector
  const filteredProjetos = useMemo(() => {
    const map = new Map<number, { id: number; nome: string }>()
    items.forEach(item => {
      if (setorFilter && !item.setores.includes(setorFilter)) return
      if (!map.has(item.projeto_id)) {
        map.set(item.projeto_id, { id: item.projeto_id, nome: item.projeto_nome })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [items, setorFilter])

  // Reset project filter when sector changes (selected project may no longer be valid)
  useEffect(() => { setProjetoFilter('') }, [setorFilter])

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (oeFilter && !item.acoes.some(a => a.oe_codigo === oeFilter)) return false
      if (acaoFilter && !item.acoes.some(a => a.numero === acaoFilter)) return false
      if (setorFilter && !item.setores.includes(setorFilter)) return false
      if (projetoFilter && item.projeto_id !== Number(projetoFilter)) return false
      if (responsavelFilter) {
        const matchUser = item.projeto_responsavel_id === responsavelFilter
          || item.responsavel_id === responsavelFilter
          || item.responsavel_entrega_id === responsavelFilter
          || item.responsavel_atividade_id === responsavelFilter
          || item.participante_user_ids.includes(responsavelFilter)
        if (!matchUser) return false
      }
      return true
    })
  }, [items, oeFilter, acaoFilter, setorFilter, projetoFilter, responsavelFilter])

  // Group by date
  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {}
    filteredItems.forEach(item => {
      if (!map[item.data]) map[item.data] = []
      map[item.data].push(item)
    })
    return map
  }, [filteredItems])

  // Count items in visible period
  const visibleItemCount = useMemo(() => {
    if (viewMode === 'mes') {
      const days = getCalendarDays(currentYear, currentMonth)
      let count = 0
      days.forEach(d => {
        if (d.isCurrentMonth) {
          const key = formatDateKey(d.date)
          count += (itemsByDate[key] || []).length
        }
      })
      return count
    } else {
      const days = getWeekDays(currentWeekStart)
      let count = 0
      days.forEach(d => {
        const key = formatDateKey(d)
        count += (itemsByDate[key] || []).length
      })
      return count
    }
  }, [viewMode, currentYear, currentMonth, currentWeekStart, itemsByDate])

  const hasFilters = !!(oeFilter || acaoFilter || setorFilter || projetoFilter || responsavelFilter)

  // Navigation
  function goToday() {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    setCurrentYear(t.getFullYear())
    setCurrentMonth(t.getMonth())
    setCurrentWeekStart(getMondayOfWeek(t))
  }

  function goPrev() {
    if (viewMode === 'mes') {
      if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
      else setCurrentMonth(m => m - 1)
    } else {
      const prev = new Date(currentWeekStart)
      prev.setDate(prev.getDate() - 7)
      setCurrentWeekStart(prev)
    }
  }

  function goNext() {
    if (viewMode === 'mes') {
      if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
      else setCurrentMonth(m => m + 1)
    } else {
      const next = new Date(currentWeekStart)
      next.setDate(next.getDate() + 7)
      setCurrentWeekStart(next)
    }
  }

  // Permission logic
  const isAdminOrMaster = profile?.role === 'admin' || profile?.role === 'master'

  function canEditDate(item: CalendarItem): boolean {
    if (!profile) return false
    if (isAdminOrMaster) return true
    if (profile.role !== 'gestor') return false
    const isSetorLider = profile.setor_id === item.setor_lider_id
    const isSetorResp = profile.setor_id === item.orgao_responsavel_setor_id
    const isRespAtividade = profile.id === item.responsavel_atividade_id
    if (item.tipo === 'entrega') {
      // Nível 2 (setor líder) ou Nível 4 (setor resp. entrega)
      return (isSetorLider || isSetorResp) && configs['proj_permitir_edicao_datas'] !== 'false'
    }
    if (item.tipo === 'atividade') {
      // Nível 3 (setor resp. entrega) ou Nível 5 (resp. individual da atividade)
      return (isSetorResp || isRespAtividade) && configs['proj_permitir_edicao_datas_atividades'] !== 'false'
    }
    return false
  }

  function needsApprovalForItem(item: CalendarItem): boolean {
    if (isAdminOrMaster) return false
    if (profile?.role !== 'gestor') return false
    const isSetorLider = profile.setor_id === item.setor_lider_id
    const isSetorResp = profile.setor_id === item.orgao_responsavel_setor_id
    const isRespAtividade = profile.id === item.responsavel_atividade_id
    return (isSetorLider || isSetorResp || isRespAtividade)
      && configs['proj_exigir_aprovacao_edicao'] === 'true'
  }

  function hasPendingSolicitacao(tipoEntidade: string, entidadeId: number) {
    return solicitacoes.some(s => s.tipo_entidade === tipoEntidade && s.entidade_id === entidadeId && s.status === 'em_analise')
  }

  async function auditLog(tipo: string, entidade: string, entidadeId: number, anterior: any, novo: any) {
    // Audit log gerenciado pelo servidor via /api/dados/projeto/[id]
    // Esta função é mantida por compat apenas — chamadas foram movidas para as rotas de API
  }

  // === Create activity from calendar ===

  const canCreateAtividade = profile && (isAdminOrMaster || (profile.role === 'gestor' && configs['proj_permitir_cadastro_atividades'] !== 'false'))

  // Projects eligible for the current user
  const eligibleProjetos = useMemo(() => {
    if (!profile) return []
    if (isAdminOrMaster) return rawProjetos
    if (profile.role !== 'gestor') return []
    return rawProjetos.filter((p: any) => {
      if (p.setor_lider_id === profile.setor_id) return true
      return (p.entregas || []).some((e: any) => {
        if ((e.entrega_participantes || []).some((ep: any) => ep.tipo_participante === 'setor' && ep.setor_id === profile.setor_id)) return true
        return (e.atividades || []).some((a: any) =>
          (a.atividade_participantes || []).some((ap: any) => ap.tipo_participante === 'setor' && ap.setor_id === profile.setor_id)
        )
      })
    })
  }, [rawProjetos, profile, isAdminOrMaster])

  // Entregas eligible for the selected project
  const eligibleEntregas = useMemo(() => {
    if (!createProjetoId || !profile) return []
    const proj = rawProjetos.find((p: any) => p.id === createProjetoId)
    if (!proj) return []
    if (isAdminOrMaster) return proj.entregas || []
    // Gestor: entregas onde é setor líder ou órgão responsável
    return (proj.entregas || []).filter((e: any) =>
      proj.setor_lider_id === profile.setor_id || e.orgao_responsavel_setor_id === profile.setor_id
    )
  }, [rawProjetos, createProjetoId, profile, isAdminOrMaster])

  // Selected project/entrega data for the form
  const createProjeto = createProjetoId ? rawProjetos.find((p: any) => p.id === createProjetoId) : null
  const createEntrega = createEntregaId && createProjeto ? (createProjeto.entregas || []).find((e: any) => e.id === createEntregaId) : null

  function handleDayDoubleClick(dateKey: string) {
    if (!canCreateAtividade) return
    setCreateDate(dateKey)
    setCreateStep(1)
    setCreateProjetoId(null)
    setCreateEntregaId(null)
    setCreateForm({ nome: '', descricao: '', status: 'aberta', motivo_status: '', responsavel_atividade_id: '', participantes: [] })
    setCreateError('')
    setShowCreateModal(true)
  }

  function handleSelectProjeto(projetoId: number) {
    setCreateProjetoId(projetoId)
    setCreateEntregaId(null)
    setCreateStep(2)
  }

  function handleSelectEntrega(entregaId: number) {
    setCreateEntregaId(entregaId)
    setCreateForm({ nome: '', descricao: '', status: 'aberta', motivo_status: '', responsavel_atividade_id: '', participantes: [] })
    setCreateError('')
    setCreateStep(3)
  }

  function updateCreateParticipante(idx: number, field: string, value: any) {
    setCreateForm(prev => {
      const parts = [...prev.participantes]
      parts[idx] = { ...parts[idx], [field]: value }
      return { ...prev, participantes: parts }
    })
  }

  function removeCreateParticipante(idx: number) {
    setCreateForm(prev => ({ ...prev, participantes: prev.participantes.filter((_: any, i: number) => i !== idx) }))
  }

  function addCreateParticipante() {
    setCreateForm(prev => ({ ...prev, participantes: [...prev.participantes, { setor_id: null, tipo_participante: 'setor', papel: '' }] }))
  }

  function pKeyCreate(p: any) {
    return p.tipo_participante === 'setor' ? `s_${p.setor_id}` : p.tipo_participante
  }

  async function saveCreateAtividade() {
    setCreateError('')

    if (!createEntrega || !createProjeto) { setCreateError('Selecione projeto e entrega.'); return }

    // Validações de campos obrigatórios
    if (!createForm.nome.trim()) { setCreateError('Preencha o nome da atividade.'); return }
    if (!createForm.descricao.trim()) { setCreateError('Preencha a descrição da atividade.'); return }

    // Validações de data
    if (createDate && createEntrega.data_final_prevista && createDate > createEntrega.data_final_prevista) {
      setCreateError(`A data da atividade não pode ser posterior à quinzena da entrega (${createEntrega.data_final_prevista}).`)
      return
    }
    if (createDate && createProjeto.data_inicio && createDate < createProjeto.data_inicio) {
      setCreateError(`A data da atividade não pode ser anterior à data de início do projeto (${createProjeto.data_inicio}).`)
      return
    }

    // Validações de participantes
    const allP = createForm.participantes || []
    for (const p of allP) {
      if ((p.setor_id || p.tipo_participante !== 'setor') && !p.papel?.trim()) {
        setCreateError('Preencha o papel de todos os participantes.')
        return
      }
    }
    const validP = allP.filter((p: any) => p.papel?.trim() && (p.setor_id || p.tipo_participante !== 'setor'))

    // Participantes subconjunto da entrega
    const entregaKeys = new Set((createEntrega.entrega_participantes || []).map((ep: any) =>
      ep.tipo_participante === 'setor' ? `s_${ep.setor_id}` : ep.tipo_participante))
    for (const ap of validP) {
      const apKey = ap.tipo_participante === 'setor' ? `s_${ap.setor_id}` : ap.tipo_participante
      if (!entregaKeys.has(apKey)) {
        setCreateError('Esta atividade inclui um participante que não está na entrega. Remova-o ou adicione-o à entrega primeiro.')
        return
      }
    }

    // Sem duplicados
    const pKeys = validP.map((p: any) => pKeyCreate(p))
    if (new Set(pKeys).size !== pKeys.length) {
      setCreateError('Há participantes duplicados nesta atividade.')
      return
    }

    setCreateSaving(true)

    // Criação de atividade via PostgreSQL Docker
    const res = await fetch(`/api/dados/projeto/${createProjeto.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_atividade',
        entrega_id: createEntregaId,
        nome: createForm.nome.trim(),
        descricao: createForm.descricao.trim(),
        data_prevista: createDate || null,
        status: createForm.status,
        motivo_status: createForm.motivo_status || null,
        responsavel_atividade_id: createForm.responsavel_atividade_id || null,
        participantes: validP.map((p: any) => ({
          setor_id: p.tipo_participante === 'setor' ? p.setor_id : null,
          tipo_participante: p.tipo_participante, papel: p.papel.trim(),
        })),
        reopen_entrega: true, // se entrega terminal, reverter para em_andamento
      }),
    })
    if (!res.ok) {
      const err = await res.json()
      setCreateError(err.error || 'Erro ao criar atividade.')
      setCreateSaving(false); return
    }

    setCreateSaving(false)
    setShowCreateModal(false)
    alert('Atividade criada com sucesso!')
    loadAll()
  }

  async function saveDate(item: CalendarItem) {
    // Não houve alteração
    if (newDate === item.data) { setEditingDate(false); return }

    // Não permitir remover a data pelo calendário (item desapareceria)
    if (!newDate) {
      alert('Não é possível remover a data pelo calendário. Para remover o prazo, edite diretamente no projeto.')
      return
    }

    setSavingDate(true)

    // Validação para entregas: atividades não podem ter data posterior
    if (item.tipo === 'entrega') {
      const posteriores = item.atividades_datas.filter(a => a.data > newDate)
      if (posteriores.length > 0) {
        const nomes = posteriores.map(a => `"${a.nome}"`).join(', ')
        alert(`Não é possível definir esta quinzena. As atividades ${nomes} têm datas posteriores. Ajuste-as primeiro.`)
        setSavingDate(false); return
      }
    }

    // Validação para atividades: data não pode ser posterior à quinzena da entrega
    if (item.tipo === 'atividade' && item.entrega_data_final && newDate > item.entrega_data_final) {
      alert(`A data da atividade não pode ser posterior à quinzena da entrega (${item.entrega_data_final}).`)
      setSavingDate(false); return
    }

    // Fluxo de aprovação
    if (needsApprovalForItem(item)) {
      if (hasPendingSolicitacao(item.tipo, item.id)) {
        alert(`Já existe uma solicitação pendente para esta ${item.tipo === 'entrega' ? 'entrega' : 'atividade'}. Aguarde a avaliação.`)
        setSavingDate(false); return
      }
      const dados = item.tipo === 'entrega'
        ? { data_final_prevista: newDate }
        : { data_prevista: newDate }
      // Solicitação via PostgreSQL Docker
      const res = await fetch(`/api/dados/projeto/${item.projeto_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_solicitacao',
          tipo_entidade: item.tipo,
          entidade_id: item.id,
          entidade_nome: item.nome,
          tipo_operacao: 'edicao',
          dados_alteracao: dados,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        alert(`Erro ao criar solicitação: ${err.error}`)
        setSavingDate(false); return
      }
      alert('Solicitação enviada para o Gabinete de Gestão de Projetos para avaliação.')
      setEditingDate(false); setSavingDate(false); loadAll(); return
    }

    // Edição direta via PostgreSQL Docker
    const res = await fetch(`/api/dados/projeto/${item.projeto_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        item.tipo === 'entrega'
          ? { action: 'update_entrega', id: item.id, data_final_prevista: newDate }
          : { action: 'update_atividade', id: item.id, data_prevista: newDate }
      ),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error || 'Erro ao salvar.')
      setSavingDate(false); return
    }

    setEditingDate(false); setSavingDate(false)
    setSelectedItem(null)
    loadAll()
  }

  function handleItemClick(item: CalendarItem, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedItem(item)
    setEditingDate(false)
  }

  function switchToWeekOf(date: Date) {
    setCurrentWeekStart(getMondayOfWeek(date))
    setViewMode('semana')
  }

  // Title
  const title = viewMode === 'mes'
    ? `${MONTH_NAMES[currentMonth]} ${currentYear}`
    : (() => {
        const end = new Date(currentWeekStart)
        end.setDate(end.getDate() + 6)
        const startDay = currentWeekStart.getDate()
        const endDay = end.getDate()
        if (currentWeekStart.getMonth() === end.getMonth()) {
          return `${startDay}–${endDay} ${MONTH_ABBR[currentWeekStart.getMonth()]} ${currentWeekStart.getFullYear()}`
        }
        return `${startDay} ${MONTH_ABBR[currentWeekStart.getMonth()]}–${endDay} ${MONTH_ABBR[end.getMonth()]} ${end.getFullYear()}`
      })()

  const todayKey = formatDateKey(today)

  if (loading) return <div className="flex justify-center py-20"><div className="animate-pulse text-sedec-500">Carregando...</div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CalendarDays size={24} className="text-orange-500" /> Calendário
          </h1>
          <p className="text-gray-500 text-sm mt-1">Entregas e atividades dos projetos</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <Filter size={16} /> Filtros
          {hasFilters && (
            <button onClick={() => { setOeFilter(''); setAcaoFilter(''); setSetorFilter(''); setProjetoFilter(''); setResponsavelFilter('') }}
              className="ml-auto text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <X size={14} /> Limpar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select value={oeFilter} onChange={e => setOeFilter(e.target.value)} className="input-field" title="Filtra por objetivo estratégico vinculado">
            <option value="">Todos os objetivos</option>
            {oes.map(o => <option key={o.codigo} value={o.codigo}>{o.codigo} — {o.nome.substring(0, 60)}</option>)}
          </select>
          <select value={acaoFilter} onChange={e => setAcaoFilter(e.target.value)} className="input-field" title="Filtra pela ação estratégica vinculada">
            <option value="">Todas as ações</option>
            {filteredAcoes.map(a => <option key={a.numero} value={a.numero}>AE {a.numero}</option>)}
          </select>
          <select value={setorFilter} onChange={e => setSetorFilter(e.target.value)} className="input-field" title="Filtra por setor líder, setor responsável pela entrega ou participante">
            <option value="">Todos os setores</option>
            {setores.map(s => <option key={s.codigo} value={s.codigo}>{s.codigo}</option>)}
          </select>
          <select value={projetoFilter} onChange={e => setProjetoFilter(e.target.value)} className="input-field" title="Filtra por projeto específico (depende dos filtros anteriores)">
            <option value="">Todos os projetos</option>
            {filteredProjetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <div title="Filtra por líder do projeto, responsável ou participante de entrega/atividade">
            <UserAutocompleteSelect
              value={responsavelFilter || null}
              onChange={val => setResponsavelFilter(val || '')}
              users={eligibleUsers}
              placeholder="Todos os responsáveis"
            />
          </div>
        </div>
      </div>

      {/* Calendar header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('mes')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'mes' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Mês
            </button>
            <button onClick={() => setViewMode('semana')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'semana' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Semana
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button onClick={goPrev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg font-semibold text-gray-800 min-w-[180px] text-center capitalize">{title}</h2>
            <button onClick={goNext} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
              <ChevronRight size={20} />
            </button>
            <button onClick={goToday}
              className="ml-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600 transition-colors">
              Hoje
            </button>
          </div>

          <span className="text-sm text-gray-500">{visibleItemCount} item(ns)</span>
        </div>
      </div>

      {/* Calendar grid */}
      {viewMode === 'mes' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {DAY_NAMES.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase">{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {getCalendarDays(currentYear, currentMonth).map((day, i) => {
              const key = formatDateKey(day.date)
              const dayItems = itemsByDate[key] || []
              const isToday = key === todayKey
              const maxPills = 3
              const overflow = dayItems.length - maxPills

              return (
                <div key={i}
                  onDoubleClick={() => day.isCurrentMonth && handleDayDoubleClick(key)}
                  className={`min-h-[80px] md:min-h-[100px] border-b border-r border-gray-100 p-1 transition-colors
                    ${!day.isCurrentMonth ? 'bg-gray-50' : canCreateAtividade ? 'cursor-pointer' : ''}
                    ${isToday ? 'ring-2 ring-inset ring-orange-400' : ''}`}>
                  <div className={`text-xs font-medium mb-1 ${!day.isCurrentMonth ? 'text-gray-300' : isToday ? 'text-orange-600 font-bold' : 'text-gray-600'}`}>
                    {day.date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, maxPills).map(item => (
                      <div key={`${item.tipo}-${item.id}`}
                        onClick={(e) => handleItemClick(item, e)}
                        title={`${item.nome} — ${item.projeto_nome}`}
                        className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80
                          border-l-2 ${item.tipo === 'entrega' ? 'border-orange-400 font-semibold' : 'border-blue-300 font-normal'}
                          ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700'}`}>
                        {item.nome}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div className="text-[10px] text-gray-400 pl-1 font-medium">+{overflow} mais</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Week headers */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {getWeekDays(currentWeekStart).map((d, i) => {
              const key = formatDateKey(d)
              const isToday = key === todayKey
              return (
                <div key={i} className={`py-2 text-center text-xs font-semibold ${isToday ? 'text-orange-600 bg-orange-50' : 'text-gray-500'}`}>
                  {DAY_NAMES[i]} {d.getDate()} {MONTH_ABBR[d.getMonth()]}
                </div>
              )
            })}
          </div>
          {/* Week cells */}
          <div className="grid grid-cols-7">
            {getWeekDays(currentWeekStart).map((d, i) => {
              const key = formatDateKey(d)
              const dayItems = itemsByDate[key] || []
              const isToday = key === todayKey

              return (
                <div key={i}
                  onDoubleClick={() => handleDayDoubleClick(key)}
                  className={`min-h-[200px] md:min-h-[300px] border-r border-gray-100 p-1.5
                    ${canCreateAtividade ? 'cursor-pointer' : ''}
                    ${isToday ? 'ring-2 ring-inset ring-orange-400' : ''}`}>
                  <div className="overflow-y-auto max-h-[280px] space-y-1">
                    {dayItems.map(item => (
                      <div key={`${item.tipo}-${item.id}`}
                        onClick={(e) => handleItemClick(item, e)}
                        title={`${item.nome} — ${item.projeto_nome}`}
                        className={`text-[10px] px-1.5 py-1 rounded cursor-pointer hover:opacity-80
                          border-l-2 ${item.tipo === 'entrega' ? 'border-orange-400 font-semibold' : 'border-blue-300 font-normal'}
                          ${STATUS_COLORS[item.status] || 'bg-gray-100 text-gray-700'}`}>
                        <div className="truncate">{item.nome}</div>
                        <div className="truncate text-[9px] opacity-70">{item.projeto_nome}</div>
                      </div>
                    ))}
                    {dayItems.length === 0 && (
                      <div className="text-[10px] text-gray-300 text-center pt-4">—</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Item detail popup */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className={`p-5 rounded-t-xl border-b ${
              selectedItem.tipo === 'entrega' ? 'bg-orange-50 border-orange-100' : 'bg-blue-50 border-blue-100'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${
                      selectedItem.tipo === 'entrega' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {selectedItem.tipo === 'entrega' ? 'Entrega' : 'Atividade'}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selectedItem.status] || 'bg-gray-100 text-gray-700'}`}>
                      {selectedItem.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-800 leading-snug">{selectedItem.nome}</h3>
                  {selectedItem.entrega_nome && (
                    <p className="text-xs text-gray-500 mt-1">Entrega: <span className="font-medium">{selectedItem.entrega_nome}</span></p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    <span className="text-gray-500">Projeto:</span> {selectedItem.projeto_nome}
                    {selectedItem.setor_lider_codigo && (
                      <> — <span className="font-medium">{selectedItem.setor_lider_codigo}</span></>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setSelectedItem(null); router.push(`/dashboard/projetos/${selectedItem.projeto_id}`) }}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                      selectedItem.tipo === 'entrega'
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                    title="Ver projeto"
                  >
                    <ExternalLink size={13} /> Ver projeto
                  </button>
                  <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">

              {/* Prazo */}
              {!editingDate ? (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays size={14} className="text-gray-400 shrink-0" />
                  <span className="text-gray-500 font-medium">Prazo:</span>
                  <span className="text-gray-700">
                    {(() => {
                      const [y, m, d] = selectedItem.data.split('-').map(Number)
                      return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
                    })()}
                  </span>
                  {canEditDate(selectedItem) && (
                    <button
                      onClick={() => { setEditingDate(true); setNewDate(selectedItem.data) }}
                      className="text-gray-400 hover:text-orange-500 transition-colors p-0.5"
                      title="Alterar data"
                    >
                      <Edit3 size={13} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <CalendarDays size={13} /> Alterar prazo
                  </div>
                  {selectedItem.tipo === 'entrega' ? (
                    <select
                      value={newDate}
                      onChange={ev => setNewDate(ev.target.value)}
                      className="input-field text-sm"
                    >
                      {QUINZENAS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type="date"
                      value={newDate}
                      max={selectedItem.entrega_data_final || undefined}
                      onChange={ev => {
                        const nd = ev.target.value
                        if (nd && selectedItem.entrega_data_final && nd > selectedItem.entrega_data_final) {
                          alert(`A data não pode ser posterior à quinzena da entrega (${selectedItem.entrega_data_final}).`)
                          return
                        }
                        setNewDate(nd)
                      }}
                      className="input-field text-sm"
                    />
                  )}
                  {selectedItem.tipo === 'atividade' && selectedItem.entrega_data_final && (
                    <p className="text-[10px] text-gray-500">
                      Data máxima: {(() => {
                        const [y, m, d] = selectedItem.entrega_data_final!.split('-').map(Number)
                        return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
                      })()}
                    </p>
                  )}
                  {needsApprovalForItem(selectedItem) && (
                    <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                      A alteração será enviada como solicitação para aprovação do Gabinete de Gestão de Projetos.
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveDate(selectedItem)}
                      disabled={savingDate}
                      className="flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Save size={12} /> {savingDate ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      onClick={() => setEditingDate(false)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 transition-colors"
                    >
                      <X size={12} /> Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Motivo do status */}
              {selectedItem.motivo_status && (
                <div className="text-sm bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <span className="font-bold text-amber-700">Motivo do status:</span>
                  <span className="text-gray-700 ml-1 italic">{selectedItem.motivo_status}</span>
                </div>
              )}

              {/* Setores participantes */}
              {selectedItem.setores.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Participantes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.setores.map(s => (
                      <span key={s} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium border border-gray-200">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Critérios de aceite (entrega only) */}
              {selectedItem.criterios_aceite && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Critérios de aceite</p>
                  <ul className="space-y-1">
                    {selectedItem.criterios_aceite.split('\n').filter(l => l.trim()).map((line, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <span className="text-gray-400 font-bold mt-0.5 shrink-0">•</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Dependências críticas (entrega only) */}
              {selectedItem.dependencias_criticas && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Dependências críticas</p>
                  <ul className="space-y-1">
                    {selectedItem.dependencias_criticas.split('\n').filter(l => l.trim()).map((line, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <span className="text-amber-500 font-bold mt-0.5 shrink-0">⚠</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}


            </div>
          </div>
        </div>
      )}

      {/* Create activity modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !createSaving && setShowCreateModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="px-5 py-4 border-b border-gray-200 bg-blue-50 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Nova Atividade</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(() => {
                      const [y, m, d] = createDate.split('-').map(Number)
                      return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
                    })()}
                  </p>
                </div>
                <button onClick={() => !createSaving && setShowCreateModal(false)} className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mt-3">
                {[1, 2, 3].map(step => (
                  <div key={step} className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      createStep === step ? 'bg-blue-500 text-white' : createStep > step ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>{step}</div>
                    <span className={`text-xs ${createStep === step ? 'text-blue-700 font-medium' : 'text-gray-400'}`}>
                      {step === 1 ? 'Projeto' : step === 2 ? 'Entrega' : 'Atividade'}
                    </span>
                    {step < 3 && <ChevronRight size={12} className="text-gray-300" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal body */}
            <div className="p-5 space-y-4">
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {createError}
                </div>
              )}

              {/* Step 1: Select project */}
              {createStep === 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selecione o projeto</label>
                  {eligibleProjetos.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhum projeto disponível para o seu setor.</p>
                  ) : (
                    <select
                      className="input-field"
                      value=""
                      onChange={e => e.target.value && handleSelectProjeto(parseInt(e.target.value))}
                    >
                      <option value="">Selecione...</option>
                      {eligibleProjetos.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.nome}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Step 2: Select entrega */}
              {createStep === 2 && (
                <div>
                  <button onClick={() => { setCreateStep(1); setCreateProjetoId(null) }}
                    className="text-xs text-blue-500 hover:text-blue-700 mb-2 flex items-center gap-1">
                    <ChevronLeft size={12} /> Voltar
                  </button>
                  <p className="text-xs text-gray-500 mb-1">Projeto: <span className="font-medium text-gray-700">{createProjeto?.nome}</span></p>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selecione a entrega</label>
                  {eligibleEntregas.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhuma entrega disponível neste projeto.</p>
                  ) : (
                    <select
                      className="input-field"
                      value=""
                      onChange={e => e.target.value && handleSelectEntrega(parseInt(e.target.value))}
                    >
                      <option value="">Selecione...</option>
                      {eligibleEntregas.map((e: any) => (
                        <option key={e.id} value={e.id}>{e.nome}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Step 3: Activity form */}
              {createStep === 3 && createEntrega && createProjeto && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setCreateStep(2); setCreateEntregaId(null) }}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                      <ChevronLeft size={12} /> Voltar
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 space-y-0.5">
                    <p>Projeto: <span className="font-medium text-gray-700">{createProjeto.nome}</span></p>
                    <p>Entrega: <span className="font-medium text-gray-700">{createEntrega.nome}</span></p>
                  </div>

                  {/* Nome */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da atividade *</label>
                    <input type="text" value={createForm.nome}
                      onChange={e => setCreateForm(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome da atividade"
                      className="input-field text-sm" disabled={createSaving} />
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                    <input type="text" value={createForm.descricao}
                      onChange={e => setCreateForm(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descrição da atividade"
                      className="input-field text-sm" disabled={createSaving} />
                  </div>

                  {/* Responsável */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                    <UserAutocompleteSelect
                      value={createForm.responsavel_atividade_id || null}
                      onChange={val => setCreateForm(prev => ({ ...prev, responsavel_atividade_id: val || '' }))}
                      users={eligibleUsers}
                      placeholder="Selecione..."
                      disabled={createSaving}
                      onRegisterNew={() => setShowGestorModal(true)}
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select value={createForm.status}
                      onChange={e => setCreateForm(prev => ({ ...prev, status: e.target.value }))}
                      className="input-field text-sm" disabled={createSaving}>
                      {Object.entries(STATUS_ATIVIDADE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>

                  {/* Data */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data prevista <span className="text-gray-400 font-normal">(prazo para conclusão)</span>
                    </label>
                    <input type="date" value={createDate}
                      onChange={e => setCreateDate(e.target.value)}
                      min={createProjeto.data_inicio || undefined}
                      max={createEntrega.data_final_prevista || undefined}
                      className="input-field text-sm" disabled={createSaving} />
                    {createEntrega.data_final_prevista && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Limite da entrega: {(() => {
                          const [y, m, d] = createEntrega.data_final_prevista.split('-').map(Number)
                          return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
                        })()}
                      </p>
                    )}
                  </div>

                  {/* Motivo (se status ≠ aberta) */}
                  {createForm.status !== 'aberta' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do status</label>
                      <input type="text" value={createForm.motivo_status}
                        onChange={e => setCreateForm(prev => ({ ...prev, motivo_status: e.target.value }))}
                        placeholder="Motivo..."
                        className="input-field text-sm" disabled={createSaving} />
                    </div>
                  )}

                  {/* Participantes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Participantes</label>
                      <button type="button" onClick={addCreateParticipante}
                        disabled={createSaving}
                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50">
                        <Plus size={12} /> Participante
                      </button>
                    </div>
                    {createForm.participantes.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Nenhum participante adicionado.</p>
                    ) : (
                      <div className="space-y-2">
                        {createForm.participantes.map((p: any, idx: number) => {
                          const usedKeys = new Set(createForm.participantes.filter((_: any, i: number) => i !== idx).map(pKeyCreate))
                          const entregaParts = createEntrega.entrega_participantes || []
                          return (
                            <div key={idx} className="flex gap-2 items-start">
                              <select
                                value={p.tipo_participante === 'setor' ? (p.setor_id || '') : p.tipo_participante}
                                onChange={ev => {
                                  const v = ev.target.value
                                  if (v === 'externo_subsegop' || v === 'externo_sedec') {
                                    updateCreateParticipante(idx, 'tipo_participante', v)
                                    updateCreateParticipante(idx, 'setor_id', null)
                                  } else {
                                    updateCreateParticipante(idx, 'tipo_participante', 'setor')
                                    updateCreateParticipante(idx, 'setor_id', parseInt(v) || null)
                                  }
                                }}
                                className="input-field text-xs flex-1" disabled={createSaving}>
                                <option value="">Participante...</option>
                                {entregaParts.map((ep: any) => {
                                  if (ep.tipo_participante === 'setor' && ep.setor_id) {
                                    const s = setores.find((ss: any) => ss.id === ep.setor_id)
                                    const k = `s_${ep.setor_id}`
                                    return <option key={k} value={ep.setor_id} disabled={usedKeys.has(k)}>
                                      {s?.codigo || 'Setor'}{usedKeys.has(k) ? ' (já)' : ''}
                                    </option>
                                  } else {
                                    const label = ep.tipo_participante === 'externo_subsegop' ? 'Ext. SUBSEGOP' : 'Ext. SEDEC'
                                    return <option key={ep.tipo_participante} value={ep.tipo_participante} disabled={usedKeys.has(ep.tipo_participante)}>
                                      {label}{usedKeys.has(ep.tipo_participante) ? ' (já)' : ''}
                                    </option>
                                  }
                                })}
                                {entregaParts.length === 0 && <option disabled>Sem participantes na entrega</option>}
                              </select>
                              <input type="text" value={p.papel || ''}
                                onChange={ev => updateCreateParticipante(idx, 'papel', ev.target.value)}
                                placeholder="Papel na atividade"
                                className="input-field text-xs flex-1" disabled={createSaving} />
                              <button type="button" onClick={() => removeCreateParticipante(idx)}
                                disabled={createSaving}
                                className="text-red-400 hover:text-red-600 mt-2 disabled:opacity-50">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Buttons */}
                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button onClick={() => setShowCreateModal(false)} disabled={createSaving}
                      className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50">
                      Cancelar
                    </button>
                    <button onClick={saveCreateAtividade} disabled={createSaving}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60 transition-colors flex items-center gap-2">
                      {createSaving && <Loader2 size={14} className="animate-spin" />}
                      Cadastrar Atividade
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RegisterGestorModal */}
      <RegisterGestorModal
        isOpen={showGestorModal}
        onClose={() => setShowGestorModal(false)}
        onSuccess={(newUser) => {
          setEligibleUsers(prev => [...prev, { id: newUser.id, nome: newUser.nome }].sort((a, b) => a.nome.localeCompare(b.nome)))
          setCreateForm(prev => ({ ...prev, responsavel_atividade_id: newUser.id }))
          setShowGestorModal(false)
        }}
        setores={setores}
      />
    </div>
  )
}
