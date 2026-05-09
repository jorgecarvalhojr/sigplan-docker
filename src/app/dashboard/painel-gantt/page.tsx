'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Filter, X, ExternalLink, ChevronRight, ChevronDown, BarChart3, Loader2 } from 'lucide-react'
import type { Profile } from '@/lib/types'
import UserAutocompleteSelect from '@/components/UserAutocompleteSelect'

/* ───────────────────── Constantes ───────────────────── */
const DAY_MS = 1000 * 60 * 60 * 24
const PX_PER_DAY = 4
const ROW_HEIGHT = 40
const HEADER_HEIGHT = 44
const TIMELINE_HEADER = 48
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/* ───────────────────── Tipos ───────────────────── */
interface GanttRow {
  type: 'project-header' | 'entrega-lane'
  projectId: number
  projectNome: string
  projectData?: any
  projectStartDate?: Date
  projectEndDate?: Date
  entregaData?: any
  entregaId?: number
  entregaNome?: string
  startDate?: Date
  endDate?: Date
  status?: string
  isSetorDireto?: boolean
  isUserDireto?: boolean  // user is responsible or participant
  atividades?: (any & { isSetorDireto: boolean })[]
}

/* ───────────────────── Helpers ───────────────────── */
function fmtShort(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/* ───────────────────── Componente principal ───────────────────── */
export default function PainelGanttPage() {
  const router = useRouter()

  /* Estado principal */
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [setores, setSetores] = useState<any[]>([])
  const [setorFilter, setSetorFilter] = useState('')
  const [setorFilterId, setSetorFilterId] = useState<number | null>(null)
  const [projetos, setProjetos] = useState<any[]>([])
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [soComEntregas, setSoComEntregas] = useState(false)
  const [popup, setPopup] = useState<{ type: 'projeto' | 'entrega' | 'atividade'; data: any; x: number; y: number } | null>(null)
  const [userFilter, setUserFilter] = useState<string | null>(null)
  const [eligibleUsers, setEligibleUsers] = useState<{ id: string; nome: string; setor_id: number | null; setor_codigo: string | null }[]>([])

  /* Refs para sincronização de scroll horizontal */
  const timelineRef = useRef<HTMLDivElement>(null)
  const timelineHeaderRef = useRef<HTMLDivElement>(null)
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ─── Carregamento de dados ─── */
  useEffect(() => {
    async function loadAll() {
      const sessionRes = await fetch('/api/auth/session')
      if (sessionRes.ok) {
        const session = await sessionRes.json()
        if (session.user) {
          setProfile(session.user as any)
        } else {
          router.push('/login'); return
        }
      } else {
        router.push('/login'); return
      }

      // Dados via PostgreSQL Docker
      const res = await fetch('/api/dados/gantt')
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()

      if (data.profile) setProfile(data.profile)
      if (data.setores) setSetores(data.setores)
      if (data.usuarios) setEligibleUsers(data.usuarios.map((u: any) => ({
        id: u.id, nome: u.nome,
        setor_id: u.setor_id, setor_codigo: u.setores?.codigo || null,
      })))
      if (data.projetos) setProjetos(data.projetos)
      setLoading(false)
    }
    loadAll()
  }, [])

  /* ─── Ao trocar filtro de setor, atualizar o setorFilterId ─── */
  useEffect(() => {
    if (!setorFilter) { setSetorFilterId(null); return }
    const s = setores.find(s => s.codigo === setorFilter)
    setSetorFilterId(s?.id || null)
  }, [setorFilter, setores])

  /* ─── Filtrar usuários elegíveis por setor selecionado ─── */
  const filteredEligibleUsers = useMemo(() => {
    if (!setorFilterId) return eligibleUsers
    return eligibleUsers.filter(u => u.setor_id === setorFilterId)
  }, [eligibleUsers, setorFilterId])

  /* ─── Ao trocar setor, limpar userFilter se usuário não pertence ao novo setor ─── */
  useEffect(() => {
    if (userFilter && setorFilterId) {
      const u = eligibleUsers.find(u => u.id === userFilter)
      if (u && u.setor_id !== setorFilterId) setUserFilter(null)
    }
  }, [setorFilterId])

  /* ─── Checar se entrega pertence ao setor (participante ou responsável) ─── */
  const isEntregaDoSetor = useCallback((entrega: any, sid: number | null) => {
    if (!sid) return false
    // Responsável da entrega é do setor?
    if (entrega.responsavel_entrega?.id) {
      // Precisamos checar via profiles se responsável é do setor — mas temos o setor_id no entrega_participantes
    }
    // Participante direto?
    if ((entrega.entrega_participantes || []).some((ep: any) => ep.setor_id === sid)) return true
    // Órgão responsável?
    if (entrega.orgao_responsavel_setor_id === sid) return true
    return false
  }, [])

  const isAtividadeDoSetor = useCallback((atividade: any, sid: number | null) => {
    if (!sid) return false
    if ((atividade.atividade_participantes || []).some((ap: any) => ap.setor_id === sid)) return true
    return false
  }, [])

  const isEntregaDoUser = useCallback((entrega: any, userId: string | null, projeto?: any) => {
    if (!userId) return false
    // Check project leader
    if (projeto && projeto.responsavel_id === userId) return true
    if (entrega.responsavel_entrega_id === userId) return true
    return (entrega.atividades || []).some((a: any) => {
      if (a.responsavel_atividade_id === userId) return true
      return (a.atividade_participantes || []).some((ap: any) => ap.user_id === userId)
    })
  }, [])

  const isAtividadeDoUser = useCallback((atividade: any, userId: string | null) => {
    if (!userId) return false
    if (atividade.responsavel_atividade_id === userId) return true
    return (atividade.atividade_participantes || []).some((ap: any) => ap.user_id === userId)
  }, [])

  /* ─── Filtrar projetos não finalizados e por setor ─── */
  const filteredProjetos = useMemo(() => {
    if (!setorFilterId) return []
    return projetos.filter(p => {
      const entregas = p.entregas || []

      // Filtro: só projetos com entregas cadastradas
      if (soComEntregas && entregas.length === 0) return false

      // Projeto finalizado = tem entregas e TODAS são resolvidas/canceladas
      if (entregas.length > 0) {
        const hasActiveEntrega = entregas.some((e: any) => e.status !== 'resolvida' && e.status !== 'cancelada')
        if (!hasActiveEntrega) return false
      }

      // Projeto do setor: setor_lider, responsável do projeto é do setor,
      // ou participante em alguma entrega/atividade
      if (p.setor_lider_id === setorFilterId) return true
      if (p.responsavel?.setor_id === setorFilterId) return true
      return entregas.some((e: any) => {
        if ((e.entrega_participantes || []).some((ep: any) => ep.setor_id === setorFilterId)) return true
        if (e.orgao_responsavel_setor_id === setorFilterId) return true
        return (e.atividades || []).some((a: any) =>
          (a.atividade_participantes || []).some((ap: any) => ap.setor_id === setorFilterId)
        )
      })
    })
  }, [projetos, setorFilterId, soComEntregas])

  /* ─── Construir rows para o Gantt ─── */
  const now = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const rows = useMemo(() => {
    const result: GanttRow[] = []
    filteredProjetos.forEach(p => {
      const entregas = (p.entregas || [])
        .filter((e: any) => e.data_final_prevista && e.status !== 'cancelada')
        .sort((a: any, b: any) => {
          const da = a.data_inicio || a.data_final_prevista || ''
          const db = b.data_inicio || b.data_final_prevista || ''
          return da.localeCompare(db) || a.id - b.id
        })

      // Data de início do projeto (regra de preferência)
      const projStart = getProjectStartDate(p, now)
      // Data de fim do projeto = última data_final_prevista
      const projEnd = entregas.reduce((max: Date, e: any) => {
        const d = new Date(e.data_final_prevista + 'T00:00:00')
        return d > max ? d : max
      }, projStart)

      result.push({
        type: 'project-header',
        projectId: p.id,
        projectNome: p.nome,
        projectData: p,
        projectStartDate: projStart,
        projectEndDate: projEnd
      })

      if (!collapsed.has(p.id)) {
        entregas.forEach((e: any) => {
          const eStart = getEntregaStartDate(e, p.data_inicio, now)
          const eEnd = new Date(e.data_final_prevista + 'T00:00:00')
          const isSetor = isEntregaDoSetor(e, setorFilterId)

          // Preparar atividades com flag de setor
          const atividades = (e.atividades || [])
            .sort((a: any, b: any) => {
              if (!a.data_prevista && !b.data_prevista) return a.id - b.id
              if (!a.data_prevista) return 1
              if (!b.data_prevista) return -1
              return a.data_prevista.localeCompare(b.data_prevista) || a.id - b.id
            })
            .map((a: any) => ({ ...a, isSetorDireto: isAtividadeDoSetor(a, setorFilterId), isUserDireto: isAtividadeDoUser(a, userFilter) }))

          result.push({
            type: 'entrega-lane',
            projectId: p.id,
            projectNome: p.nome,
            entregaData: { ...e, projeto_nome: p.nome },
            entregaId: e.id,
            entregaNome: e.nome,
            startDate: eStart,
            endDate: eEnd,
            status: e.status,
            isSetorDireto: isSetor,
            isUserDireto: isEntregaDoUser(e, userFilter, p),
            atividades
          })
        })
      }
    })
    return result
  }, [filteredProjetos, collapsed, now, setorFilterId, isEntregaDoSetor, isAtividadeDoSetor, userFilter, isEntregaDoUser, isAtividadeDoUser])

  /* ─── Calcular extensão da timeline ─── */
  const { minDate, maxDate, toX, timelineWidth, months } = useMemo(() => {
    const min = new Date(now.getTime() - 7 * DAY_MS)
    let max = new Date(now.getTime() + 365 * DAY_MS) // 12 meses default

    // Expandir se houver datas além
    rows.forEach(r => {
      if (r.endDate && r.endDate.getTime() + 14 * DAY_MS > max.getTime()) {
        max = new Date(r.endDate.getTime() + 14 * DAY_MS)
      }
      if (r.projectEndDate && r.projectEndDate.getTime() + 14 * DAY_MS > max.getTime()) {
        max = new Date(r.projectEndDate.getTime() + 14 * DAY_MS)
      }
      ;(r.atividades || []).forEach((a: any) => {
        if (a.data_prevista) {
          const d = new Date(a.data_prevista + 'T00:00:00')
          if (d.getTime() + 14 * DAY_MS > max.getTime()) max = new Date(d.getTime() + 14 * DAY_MS)
        }
      })
    })

    const totalDays = Math.ceil((max.getTime() - min.getTime()) / DAY_MS)
    const width = totalDays * PX_PER_DAY

    const toXFn = (d: Date) => Math.round(((d.getTime() - min.getTime()) / DAY_MS) * PX_PER_DAY)

    // Gerar grid de meses
    const monthsList: { label: string; x: number }[] = []
    const cur = new Date(min.getFullYear(), min.getMonth() + 1, 1)
    while (cur <= max) {
      monthsList.push({ label: `${MESES[cur.getMonth()]}/${String(cur.getFullYear()).slice(-2)}`, x: toXFn(cur) })
      cur.setMonth(cur.getMonth() + 1)
    }

    return { minDate: min, maxDate: max, toX: toXFn, timelineWidth: width, months: monthsList }
  }, [rows, now])

  /* ─── Sincronizar scroll horizontal (timeline body → timeline header) ─── */
  const syncHorizontal = useCallback(() => {
    if (timelineRef.current && timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = timelineRef.current.scrollLeft
    }
  }, [])

  /* ─── Scroll inicial para "hoje" ─── */
  useEffect(() => {
    if (!loading && timelineRef.current) {
      const todayX = toX(now)
      const scrollX = Math.max(0, todayX - 100)
      timelineRef.current.scrollLeft = scrollX
      if (timelineHeaderRef.current) timelineHeaderRef.current.scrollLeft = scrollX
    }
  }, [loading, toX, now])

  /* ─── Popup handlers (com delay para permitir interação com o popup) ─── */
  const showPopup = useCallback((type: 'projeto' | 'entrega' | 'atividade', data: any, e: React.MouseEvent) => {
    if (popupTimeoutRef.current) { clearTimeout(popupTimeoutRef.current); popupTimeoutRef.current = null }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPopup({ type, data, x: rect.right + 8, y: rect.top })
  }, [])
  const hidePopup = useCallback(() => {
    popupTimeoutRef.current = setTimeout(() => setPopup(null), 150)
  }, [])
  const cancelHidePopup = useCallback(() => {
    if (popupTimeoutRef.current) { clearTimeout(popupTimeoutRef.current); popupTimeoutRef.current = null }
  }, [])

  /* ─── Colapsar/expandir ─── */
  function toggleCollapse(pid: number) {
    setCollapsed(prev => {
      const n = new Set(prev)
      if (n.has(pid)) n.delete(pid); else n.add(pid)
      return n
    })
  }

  /* ─── Altura total do conteúdo ─── */
  const totalHeight = useMemo(() => {
    return rows.reduce((h, r) => h + (r.type === 'project-header' ? HEADER_HEIGHT : ROW_HEIGHT), 0)
  }, [rows])

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-sedec-500 mr-2" size={24} />
        <span className="text-gray-500">Carregando painel...</span>
      </div>
    )
  }

  const todayX = toX(now)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Gantt</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visão consolidada de projetos e entregas por setor</p>
        </div>
      </div>

      {/* Filtro de setor */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-gray-400" />
          <label className="text-sm font-medium text-gray-600">Setor:</label>
          <select
            value={setorFilter}
            onChange={e => setSetorFilter(e.target.value)}
            className="input-field w-auto min-w-[220px]"
            title="Exibe projetos por setor líder, setor responsável pela entrega ou setores participantes"
          >
            <option value="" disabled>Selecione um setor</option>
            {setores.map(s => (
              <option key={s.codigo} value={s.codigo}>{s.codigo} — {s.nome_completo}</option>
            ))}
          </select>
          <span className="border-l border-gray-200 pl-3 ml-1" />
          <label className="text-sm font-medium text-gray-600">Exibir:</label>
          <select
            value={soComEntregas ? 'com_entregas' : 'todos'}
            onChange={e => setSoComEntregas(e.target.value === 'com_entregas')}
            className="input-field w-auto min-w-[200px]"
            title="Filtra entre todos os projetos ou apenas os que possuem entregas cadastradas"
          >
            <option value="todos">Todos os projetos</option>
            <option value="com_entregas">Somente com entregas</option>
          </select>
          <span className="border-l border-gray-200 pl-3 ml-1" />
          <label className="text-sm font-medium text-gray-600">Resp./Part.:</label>
          <div className="w-[220px]" title="Filtra por líder do projeto, responsável ou participante de entrega/atividade">
            <UserAutocompleteSelect
              value={userFilter}
              onChange={val => setUserFilter(val)}
              users={filteredEligibleUsers}
              placeholder="Todos"
            />
          </div>
          {filteredProjetos.length > 0 && (
            <span className="text-xs text-gray-400 ml-2">
              {filteredProjetos.length} projeto{filteredProjetos.length !== 1 ? 's' : ''} encontrado{filteredProjetos.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 mb-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-blue-400 inline-block" /> Em andamento</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-green-400 inline-block" /> Resolvida</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-400 inline-block" /> Atrasada</span>
        <span className="border-l border-gray-300 pl-3 flex items-center gap-1"><span className="w-3 h-2 rounded bg-blue-400 opacity-90 border-l-2 border-sedec-600 inline-block" /> Do setor</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-blue-400 opacity-35 inline-block" /> Contexto</span>
        <span className="border-l border-gray-300 pl-3 flex items-center gap-1"><span className="text-indigo-800 text-[11px]">◆</span> Atividade do setor</span>
        <span className="flex items-center gap-1"><span className="text-indigo-800 text-[9px] opacity-50">◇</span> Atividade contexto</span>
        {userFilter && (
          <>
            <span className="border-l border-gray-300 pl-3 flex items-center gap-1"><span className="w-3 h-2 rounded bg-orange-400 border-l-2 border-orange-600 inline-block" /> Resp./Part. filtrado</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-blue-400 opacity-50 inline-block" /> Setor participa (sem o usuário)</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-blue-400 opacity-15 inline-block" /> Setor não participa</span>
          </>
        )}
      </div>

      {/* Gantt Container */}
      {!setorFilter ? (
        <div className="card p-12 text-center text-gray-400">
          <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
          <p>Selecione um setor para visualizar o painel Gantt.</p>
        </div>
      ) : filteredProjetos.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum projeto não finalizado encontrado para o setor selecionado.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
          {/* ── Header row — sticky abaixo do header do dashboard ── */}
          <div className="sticky top-[99px] md:top-[66px] z-20 bg-white border-b border-gray-300 flex rounded-t-lg">
            {/* Header do painel esquerdo */}
            <div className="w-[240px] min-w-[240px] border-r border-gray-200 bg-gray-50 flex items-center px-3 rounded-tl-lg"
                 style={{ height: TIMELINE_HEADER }}>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Projetos / Entregas</span>
            </div>
            {/* Header da timeline — meses (scroll horizontal sincronizado via JS) */}
            <div ref={timelineHeaderRef} className="flex-1 min-w-0 overflow-hidden rounded-tr-lg"
                 style={{ height: TIMELINE_HEADER }}>
              <div className="relative" style={{ width: timelineWidth, height: TIMELINE_HEADER }}>
                {months.map((m, i) => (
                  <div key={i} className="absolute top-0 h-full" style={{ left: m.x }}>
                    <div className="w-px h-full bg-gray-200" />
                    <span className="absolute top-3 ml-1 text-[10px] text-gray-400 font-medium whitespace-nowrap">{m.label}</span>
                  </div>
                ))}
                {/* Linha "hoje" no header */}
                <div className="absolute top-0 h-full z-20" style={{ left: todayX }}>
                  <div className="w-0.5 h-full bg-orange-400 opacity-70" />
                  <span className="absolute top-1 text-[9px] text-orange-500 font-bold whitespace-nowrap" style={{ transform: 'translateX(-50%)' }}>hoje</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Body — scroll vertical é do navegador, horizontal é da timeline ── */}
          <div className="flex">
            {/* Painel esquerdo (nomes) — altura total, sem scroll interno */}
            <div className="w-[240px] min-w-[240px] border-r border-gray-200 bg-white">
              <div className="relative" style={{ height: totalHeight }}>
                {renderLeftPanel()}
              </div>
            </div>

            {/* Timeline (barras + marcos) — scroll horizontal */}
            <div ref={timelineRef} className="flex-1 min-w-0 overflow-x-auto"
                 onScroll={syncHorizontal}>
              <div className="relative" style={{ width: timelineWidth, height: totalHeight }}>
                {/* Grid de meses (linhas verticais estendidas) */}
                {months.map((m, i) => (
                  <div key={i} className="absolute top-0 w-px bg-gray-100" style={{ left: m.x, height: totalHeight }} />
                ))}
                {/* Linha "hoje" no corpo */}
                <div className="absolute top-0 w-0.5 bg-orange-400 opacity-40 z-10" style={{ left: todayX, height: totalHeight }} />

                {/* Rows */}
                {renderTimelineRows()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup */}
      {popup && <PopupCard popup={popup} onClose={hidePopup} onEnter={cancelHidePopup} />}
    </div>
  )

  /* ─── Render: Painel esquerdo ─── */
  function renderLeftPanel() {
    let yOffset = 0
    return rows.map((row, i) => {
      const y = yOffset
      const h = row.type === 'project-header' ? HEADER_HEIGHT : ROW_HEIGHT
      yOffset += h

      if (row.type === 'project-header') {
        return (
          <div key={`lp-${row.projectId}`}
               className="absolute w-full flex items-center gap-1.5 px-2 bg-sedec-50 border-b-2 border-sedec-200"
               style={{ top: y, height: HEADER_HEIGHT }}
               onMouseEnter={e => showPopup('projeto', row.projectData, e)}
               onMouseLeave={hidePopup}>
            <button onClick={() => toggleCollapse(row.projectId)}
                    className="text-gray-400 hover:text-gray-600 shrink-0 p-0.5">
              {collapsed.has(row.projectId) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
            <span className="font-semibold text-xs text-sedec-700 truncate flex-1 cursor-default" title={row.projectNome}>
              {row.projectNome}
            </span>
            <button
              onClick={e => { e.stopPropagation(); window.open(`/dashboard/projetos/${row.projectId}`, '_blank') }}
              className="text-gray-400 hover:text-sedec-600 transition-colors shrink-0 p-0.5"
              title="Abrir projeto em nova aba">
              <ExternalLink size={13} />
            </button>
          </div>
        )
      }

      // Entrega lane
      const isUserMatch = row.isUserDireto
      const opacity = userFilter
        ? (isUserMatch ? '' : row.isSetorDireto ? 'opacity-60' : 'opacity-30')
        : (row.isSetorDireto ? '' : 'opacity-60')
      return (
        <div key={`le-${row.entregaId}`}
             className={`absolute w-full flex items-center px-2 pl-7 border-b border-gray-100 ${opacity} ${userFilter && isUserMatch ? 'bg-orange-50/50' : ''}`}
             style={{ top: y, height: ROW_HEIGHT }}
             onMouseEnter={e => showPopup('entrega', row.entregaData, e)}
             onMouseLeave={hidePopup}>
          {(row.isSetorDireto || (userFilter && isUserMatch)) && <div className={`absolute left-0 top-1 bottom-1 w-[3px] rounded-r ${userFilter && isUserMatch ? 'bg-orange-500' : 'bg-sedec-500'}`} />}
          <span className={`text-[11px] truncate cursor-default ${userFilter && isUserMatch ? 'text-orange-700 font-medium' : 'text-gray-600'}`} title={row.entregaNome}>
            {row.entregaNome}
          </span>
        </div>
      )
    })
  }

  /* ─── Render: Timeline rows ─── */
  function renderTimelineRows() {
    let yOffset = 0
    return rows.map((row, i) => {
      const y = yOffset
      const h = row.type === 'project-header' ? HEADER_HEIGHT : ROW_HEIGHT
      yOffset += h

      if (row.type === 'project-header') {
        return (
          <div key={`tp-${row.projectId}`}
               className="absolute w-full bg-sedec-50/50 border-b-2 border-sedec-200"
               style={{ top: y, height: HEADER_HEIGHT }} />
        )
      }

      // Entrega lane — barra + marcos
      if (!row.startDate || !row.endDate) return null

      const barLeft = toX(row.startDate)
      const barRight = toX(row.endDate)
      const barWidth = Math.max(barRight - barLeft, 6)

      const isResolvida = row.status === 'resolvida'
      const isAtrasada = !isResolvida && row.status !== 'cancelada' && row.endDate < now
      const barColor = isResolvida ? 'bg-green-400' : isAtrasada ? 'bg-red-400' : 'bg-blue-400'
      const isDireto = row.isSetorDireto
      const isUserMatch = row.isUserDireto
      // Three-level opacity when userFilter is active
      const barOpacity = userFilter
        ? (isUserMatch ? 'opacity-100' : isDireto ? 'opacity-50' : 'opacity-15')
        : (isDireto ? 'opacity-90' : 'opacity-30')

      return (
        <div key={`te-${row.entregaId}`}
             className="absolute w-full border-b border-gray-50"
             style={{ top: y, height: ROW_HEIGHT }}>
          {/* Barra da entrega */}
          <div
            className={`absolute rounded ${barColor} ${barOpacity} cursor-pointer ${userFilter && isUserMatch ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
            style={{ left: barLeft, width: barWidth, top: 10, height: 20 }}
            onMouseEnter={e => showPopup('entrega', row.entregaData, e)}
            onMouseLeave={hidePopup}
          >
            {(isDireto || (userFilter && isUserMatch)) && <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l ${userFilter && isUserMatch ? 'bg-orange-600' : 'bg-sedec-600'}`} />}
            <span className={`absolute inset-0 flex items-center px-1.5 text-[9px] truncate drop-shadow-sm ${isDireto ? 'text-white font-medium' : 'text-white/70'}`}>
              {barWidth > 40 ? row.entregaNome : ''}
            </span>
          </div>

          {/* Datas */}
          <span className="absolute text-[7px] text-gray-400 whitespace-nowrap" style={{ left: barLeft, top: 2 }}>
            {fmtShort(row.startDate)}
          </span>
          <span className={`absolute text-[7px] whitespace-nowrap font-medium ${isAtrasada ? 'text-red-600' : 'text-gray-500'}`}
                style={{ left: barLeft + barWidth - 28, top: 2 }}>
            {fmtShort(row.endDate)}
          </span>

          {/* Marcos de atividade */}
          {(row.atividades || []).map((a: any, ai: number) => {
            let ax: number
            if (a.data_prevista) {
              ax = toX(new Date(a.data_prevista + 'T00:00:00'))
            } else {
              // Sem data: posicionar no início da barra com espaçamento
              ax = barLeft + 4 + ai * 10
            }

            const aResolved = a.status === 'resolvida'
            const aOverdue = !aResolved && a.status !== 'cancelada' && a.data_prevista && new Date(a.data_prevista + 'T00:00:00') < now
            const aColor = aResolved ? 'text-emerald-900' : aOverdue ? 'text-rose-900' : 'text-indigo-800'
            const whiteOutline = { filter: 'drop-shadow(0 0 1.5px white) drop-shadow(0 0 1.5px white)' }

            if (a.isSetorDireto) {
              const isAUserMatch = userFilter && a.isUserDireto
              return (
                <div key={a.id} className={`absolute ${isAUserMatch ? 'text-orange-700' : aColor} cursor-pointer z-10`}
                     style={{ left: ax - 5, top: 13, ...whiteOutline }}
                     onMouseEnter={e => showPopup('atividade', { ...a, projeto_nome: row.projectNome, entrega_nome: row.entregaNome }, e)}
                     onMouseLeave={hidePopup}>
                  <span className={`${isAUserMatch ? 'text-[14px]' : 'text-[12px]'} font-bold leading-none`}>&#9670;</span>
                  {isAUserMatch && (
                    <span className="absolute left-3 top-0.5 bg-orange-100 text-orange-800 text-[7px] px-1 rounded whitespace-nowrap max-w-[80px] truncate" title={a.nome}>
                      {a.nome}
                    </span>
                  )}
                </div>
              )
            }
            // Contexto: diamante vazio, menor (or highlighted if user matches)
            const isAUserCtx = userFilter && a.isUserDireto
            return (
              <div key={a.id} className={`absolute ${isAUserCtx ? 'text-orange-700' : aColor} ${isAUserCtx ? '' : 'opacity-50'} cursor-pointer z-10`}
                   style={{ left: ax - 4, top: 14, ...whiteOutline }}
                   onMouseEnter={e => showPopup('atividade', { ...a, projeto_nome: row.projectNome, entrega_nome: row.entregaNome }, e)}
                   onMouseLeave={hidePopup}>
                <span className={`${isAUserCtx ? 'text-[12px] font-bold' : 'text-[9px]'} leading-none`}>{isAUserCtx ? '\u25C6' : '\u25C7'}</span>
                {isAUserCtx && (
                  <span className="absolute left-3 top-0.5 bg-orange-100 text-orange-800 text-[7px] px-1 rounded whitespace-nowrap max-w-[80px] truncate" title={a.nome}>
                    {a.nome}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )
    })
  }
}

/* ───────────────────── Helpers de data ───────────────────── */

function getProjectStartDate(projeto: any, fallback: Date): Date {
  // 1. data_inicio do projeto
  if (projeto.data_inicio) return new Date(projeto.data_inicio + 'T00:00:00')
  // 2. Menor data_inicio de entrega
  const entregaDates = (projeto.entregas || [])
    .filter((e: any) => e.data_inicio)
    .map((e: any) => new Date(e.data_inicio + 'T00:00:00').getTime())
  if (entregaDates.length > 0) return new Date(Math.min(...entregaDates))
  // 3. Menor data_prevista de atividade
  const ativDates: number[] = []
  ;(projeto.entregas || []).forEach((e: any) => {
    ;(e.atividades || []).forEach((a: any) => {
      if (a.data_prevista) ativDates.push(new Date(a.data_prevista + 'T00:00:00').getTime())
    })
  })
  if (ativDates.length > 0) return new Date(Math.min(...ativDates))
  // 4. Data atual
  return new Date(fallback.getTime())
}

function getEntregaStartDate(entrega: any, projetoDataInicio: string | null, fallback: Date): Date {
  // 1. data_inicio da entrega
  if (entrega.data_inicio) return new Date(entrega.data_inicio + 'T00:00:00')
  // 2. Menor data_prevista de atividade na entrega
  const ativDates = (entrega.atividades || [])
    .filter((a: any) => a.data_prevista)
    .map((a: any) => new Date(a.data_prevista + 'T00:00:00').getTime())
  if (ativDates.length > 0) return new Date(Math.min(...ativDates))
  // 3. data_inicio do projeto
  if (projetoDataInicio) return new Date(projetoDataInicio + 'T00:00:00')
  // 4. Data atual
  return new Date(fallback.getTime())
}

/* ───────────────────── Componente Popup ───────────────────── */

function PopupCard({ popup, onClose, onEnter }: { popup: { type: string; data: any; x: number; y: number }; onClose: () => void; onEnter: () => void }) {
  const maxW = 380
  const maxH = 350

  // Clamping para não sair da viewport
  const x = Math.min(popup.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - maxW - 16)
  const y = Math.min(Math.max(popup.y, 8), (typeof window !== 'undefined' ? window.innerHeight : 800) - maxH - 16)

  return (
    <div className="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 p-4 text-xs space-y-1.5 overflow-y-auto"
         style={{ left: x, top: y, maxWidth: maxW, maxHeight: maxH }}
         onMouseEnter={onEnter}
         onMouseLeave={onClose}>
      {popup.type === 'projeto' && <ProjectPopup data={popup.data} />}
      {popup.type === 'entrega' && <EntregaPopup data={popup.data} />}
      {popup.type === 'atividade' && <AtividadePopup data={popup.data} />}
    </div>
  )
}

function ProjectPopup({ data }: { data: any }) {
  return (
    <>
      <div className="font-bold text-sm text-sedec-700 mb-2">{data.nome}</div>
      {data.descricao && <Field label="Descrição" value={data.descricao} />}
      {data.problema_resolve && <Field label="Problema que resolve" value={data.problema_resolve} />}
      <Field label="Setor líder" value={data.setor_lider?.nome_completo || data.setor_lider?.codigo || '—'} />
      <Field label="Responsável" value={data.responsavel?.nome || '—'} />
      <Field label="Data início" value={fmtDate(data.data_inicio)} />
      <Field label="Entregas" value={`${(data.entregas || []).length}`} />
      {(data.projeto_acoes || []).length > 0 && (
        <div>
          <span className="font-medium text-gray-500">Ações vinculadas: </span>
          {data.projeto_acoes.map((pa: any, i: number) => (
            <span key={i} className="inline-block bg-sedec-50 text-sedec-700 px-1.5 py-0.5 rounded text-[10px] mr-1 mt-0.5">
              {pa.acao_estrategica?.numero} — {pa.acao_estrategica?.nome}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

function EntregaPopup({ data }: { data: any }) {
  return (
    <>
      <div className="font-bold text-sm text-gray-800 mb-1">{data.nome}</div>
      {data.projeto_nome && <div className="text-[10px] text-gray-400 -mt-1 mb-2">Projeto: {data.projeto_nome}</div>}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor(data.status)}`}>{statusLabel(data.status)}</span>
        {data.motivo_status && <span className="text-[10px] text-amber-600 italic">({data.motivo_status})</span>}
      </div>
      {data.descricao && <Field label="Descrição" value={data.descricao} />}
      <div className="flex gap-4">
        <Field label="Início" value={fmtDate(data.data_inicio)} />
        <Field label="Prazo" value={fmtDate(data.data_final_prevista)} />
      </div>
      {data.criterios_aceite && <Field label="Critérios de aceite" value={data.criterios_aceite} />}
      {data.dependencias_criticas && <Field label="Dependências" value={data.dependencias_criticas} />}
      <Field label="Responsável" value={data.responsavel_entrega?.nome || '—'} />
      {(data.entrega_participantes || []).length > 0 && (
        <div>
          <span className="font-medium text-gray-500">Participantes: </span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {data.entrega_participantes.map((ep: any) => (
              <span key={ep.id} className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                {ep.setor?.codigo || ep.tipo_participante}{ep.papel ? ` (${ep.papel})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      <Field label="Atividades" value={`${(data.atividades || []).length}`} />
    </>
  )
}

function AtividadePopup({ data }: { data: any }) {
  return (
    <>
      <div className="font-bold text-sm text-gray-800 mb-1">{data.nome}</div>
      {(data.projeto_nome || data.entrega_nome) && (
        <div className="text-[10px] text-gray-400 -mt-1 mb-2">
          {data.projeto_nome && <>Projeto: {data.projeto_nome}</>}
          {data.entrega_nome && <> · Entrega: {data.entrega_nome}</>}
        </div>
      )}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor(data.status)}`}>{statusLabel(data.status)}</span>
        {data.motivo_status && <span className="text-[10px] text-amber-600 italic">({data.motivo_status})</span>}
      </div>
      {data.descricao && <Field label="Descrição" value={data.descricao} />}
      <Field label="Data prevista" value={fmtDate(data.data_prevista)} />
      <Field label="Responsável" value={data.responsavel_atividade?.nome || '—'} />
      {(data.atividade_participantes || []).length > 0 && (
        <div>
          <span className="font-medium text-gray-500">Participantes: </span>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {data.atividade_participantes.map((ap: any) => (
              <span key={ap.id} className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px]">
                {ap.setor?.codigo || ap.tipo_participante}{ap.papel ? ` (${ap.papel})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div><span className="font-medium text-gray-500">{label}: </span><span className="text-gray-700">{value}</span></div>
  )
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  const parts = d.split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function statusLabel(s: string | null | undefined) {
  const m: Record<string, string> = {
    aberta: 'Aberta', em_andamento: 'Em andamento', aguardando: 'Aguardando',
    resolvida: 'Resolvida', cancelada: 'Cancelada'
  }
  return m[s || ''] || s || '—'
}

function statusColor(s: string | null | undefined) {
  const m: Record<string, string> = {
    aberta: 'bg-gray-100 text-gray-700',
    em_andamento: 'bg-blue-100 text-blue-700',
    aguardando: 'bg-yellow-100 text-yellow-700',
    resolvida: 'bg-green-100 text-green-700',
    cancelada: 'bg-red-100 text-red-700'
  }
  return m[s || ''] || 'bg-gray-100 text-gray-700'
}
