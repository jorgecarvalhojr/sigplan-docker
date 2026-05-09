'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save, PackagePlus, ListPlus, Info, HelpCircle, BookOpen } from 'lucide-react'
import ProjectGuidelineModal from '@/components/ProjectGuidelineModal'
import AIAssistantsCard from '@/components/AIAssistantsCard'
import ResultadosSection from '@/components/ResultadosSection'
import HelpTooltipModal, { HelpType } from '@/components/HelpTooltipModal'
import UserAutocompleteSelect from '@/components/UserAutocompleteSelect'
import RegisterGestorModal from '@/components/RegisterGestorModal'
import { sendPushForAlerts } from '@/lib/push-client'
import type { Profile } from '@/lib/types'

interface Participante { setor_id: number | null; tipo_participante: string; papel: string }
interface AtivParticipante { user_id: string | null; setor_id: number | null; tipo_participante: string; papel: string }
interface Atividade { nome: string; descricao: string; data_prevista: string; status: string; motivo_status: string; responsavel_atividade_id: string | null; participantes: AtivParticipante[]; resultado_descricao: string }
interface Entrega {
  nome: string; descricao: string; criterios_aceite: string; dependencias_criticas: string
  quinzena: string; status: string; motivo_status: string
  orgao_responsavel_setor_id: number | null; responsavel_entrega_id: string | null
  participantes: Participante[]; atividades: Atividade[]
  resultado_descricao: string
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

const STATUS_ENTREGA: Record<string, { label: string; color: string; bg: string; hint: string }> = {
  aberta: { label: 'Aberta', color: 'text-gray-600', bg: 'bg-gray-100', hint: 'Ainda não iniciado' },
  em_andamento: { label: 'Em andamento', color: 'text-blue-700', bg: 'bg-blue-100', hint: 'Trabalho em andamento' },
  aguardando: { label: 'Aguardando', color: 'text-yellow-700', bg: 'bg-yellow-100', hint: 'Parado — depende de retorno de outro órgão' },
  resolvida: { label: 'Resolvida', color: 'text-green-700', bg: 'bg-green-100', hint: 'Finalizado' },
  cancelada: { label: 'Cancelada', color: 'text-red-700', bg: 'bg-red-100', hint: 'Não é mais necessário' },
}

export default function NovoProjetoPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [setores, setSetores] = useState<{ id: number; codigo: string; nome_completo: string }[]>([])
  const [acoes, setAcoes] = useState<{ id: number; numero: string; nome: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [problemaResolve, setProblemaResolve] = useState('')
  const [causas, setCausas] = useState('')
  const [consequenciasDiretas, setConsequenciasDiretas] = useState('')
  const [objetivos, setObjetivos] = useState('')
  const [setorLiderId, setSetorLiderId] = useState<number | ''>('')
  const [responsavelId, setResponsavelId] = useState<string | null>(null)
  const [indicadores, setIndicadores] = useState<{ nome: string, formula: string, fonte_dados: string, periodicidade: string, unidade_medida: string, responsavel: string, meta: string }[]>([])
  const [riscos, setRiscos] = useState<{ natureza: string, probabilidade: string, impacto: string, medida_resposta: string }[]>([])
  const [dependenciasProjetos, setDependenciasProjetos] = useState('')
  const savingRef = useRef(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalShowCheckbox, setModalShowCheckbox] = useState(false)
  const [helpType, setHelpType] = useState<HelpType>(null)
  const [tipoAcao, setTipoAcao] = useState<string[]>([])
  const [acoesSelecionadas, setAcoesSelecionadas] = useState<number[]>([])
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [eligibleUsers, setEligibleUsers] = useState<{ id: string; nome: string; email: string; role: string; setor_id: number | null; setor_codigo: string | null }[]>([])
  const [showGestorModal, setShowGestorModal] = useState<false | ('gestor' | 'usuario')[]>(false)
  const [dataInicio, setDataInicio] = useState('')

  const router = useRouter()

  useEffect(() => {
    const hideGuideline = localStorage.getItem('hideProjectGuidelineV2')
    if (hideGuideline !== 'true') {
      setModalOpen(true)
      setModalShowCheckbox(true)
    }
  }, [])

  const openHelpModal = () => {
    setModalShowCheckbox(false)
    setModalOpen(true)
  }

  useEffect(() => {
    async function load() {
      const sessionRes = await fetch('/api/auth/session')
      if (!sessionRes.ok) { router.push('/login'); return }
      const session = await sessionRes.json()
      if (!session.user) { router.push('/login'); return }

      // Dados do formulário via PostgreSQL Docker
      const res = await fetch('/api/dados/projeto')
      if (!res.ok) { router.push('/dashboard/projetos'); return }
      const data = await res.json()

      if (data.profile) {
        setProfile(data.profile as any)
        if (data.profile.role === 'gestor' && data.profile.setor_id) {
          setSetorLiderId(data.profile.setor_id)
        }
      }

      if (data.setores) setSetores(data.setores)
      if (data.usuarios) setEligibleUsers(data.usuarios.map((u: any) => ({
        id: u.id, nome: u.nome, email: u.email || '', role: u.role || '',
        setor_id: u.setor_id, setor_codigo: u.setores?.codigo || null,
      })))
      if (data.acoes) setAcoes(data.acoes.map((a: any) => ({
        id: a.id, numero: a.numero, nome: a.nome,
      })))
      if (data.configuracoes) {
        setConfigs(data.configuracoes)
        if (data.profile?.role === 'gestor' && data.configuracoes['proj_permitir_cadastro'] === 'false') {
          alert('O cadastro de projetos está desabilitado no momento.')
          router.push('/dashboard/projetos')
          return
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  const TIPOS_ACAO = [
    'Prevenção', 'Mitigação', 'Preparação', 'Resposta', 'Recuperação',
    'Gestão/Governança', 'Inovação', 'Integração'
  ]

  const isAdminOrMaster = profile?.role === 'admin' || profile?.role === 'master'
  const setoresDisponiveis = isAdminOrMaster ? setores : setores.filter(s => s.id === profile?.setor_id)
  const usuariosDisponiveis = isAdminOrMaster ? eligibleUsers : eligibleUsers.filter(u => u.setor_id === profile?.setor_id)

  function toggleTipoAcao(tipo: string) {
    setTipoAcao(prev => prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo])
  }

  function addEntrega() {
    setEntregas([...entregas, {
      nome: '', descricao: '', criterios_aceite: '', dependencias_criticas: '', quinzena: '',
      status: 'aberta', motivo_status: '',
      orgao_responsavel_setor_id: null, responsavel_entrega_id: null,
      participantes: [{ setor_id: null, tipo_participante: 'setor', papel: '' }],
      atividades: [],
      resultado_descricao: ''
    }])
  }

  function updateEntrega(idx: number, field: string, value: any) {
    setEntregas(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  function removeEntrega(idx: number) {
    if (!confirm('Remover esta entrega e todas as suas atividades?')) return
    setEntregas(prev => prev.filter((_, i) => i !== idx))
  }

  function addParticipanteEntrega(entregaIdx: number) {
    setEntregas(prev => prev.map((e, i) =>
      i === entregaIdx ? { ...e, participantes: [...e.participantes, { setor_id: null, tipo_participante: 'setor', papel: '' }] } : e))
  }

  function updateParticipanteEntrega(eIdx: number, pIdx: number, field: string, value: any) {
    setEntregas(prev => prev.map((e, i) => i === eIdx ? {
      ...e, participantes: e.participantes.map((p, j) => j === pIdx ? { ...p, [field]: value } : p)
    } : e))
  }

  function removeParticipanteEntrega(eIdx: number, pIdx: number) {
    setEntregas(prev => prev.map((e, i) => i === eIdx ? {
      ...e, participantes: e.participantes.filter((_, j) => j !== pIdx)
    } : e))
  }

  function addAtividade(entregaIdx: number) {
    setEntregas(prev => prev.map((e, i) => i === entregaIdx ? {
      ...e, atividades: [...e.atividades, { nome: '', descricao: '', data_prevista: '', status: 'aberta', motivo_status: '', responsavel_atividade_id: null, participantes: [], resultado_descricao: '' }]
    } : e))
  }

  function updateAtividade(eIdx: number, aIdx: number, field: string, value: any) {
    setEntregas(prev => prev.map((e, i) => i === eIdx ? {
      ...e, atividades: e.atividades.map((a, j) => j === aIdx ? { ...a, [field]: value } : a)
    } : e))
  }

  function removeAtividade(eIdx: number, aIdx: number) {
    if (!confirm('Remover esta atividade?')) return
    setEntregas(prev => prev.map((e, i) => i === eIdx ? {
      ...e, atividades: e.atividades.filter((_, j) => j !== aIdx)
    } : e))
  }

  function addParticipanteAtividade(eIdx: number, aIdx: number) {
    setEntregas(prev => prev.map((e, i) => i === eIdx ? {
      ...e, atividades: e.atividades.map((a, j) => j === aIdx ? {
        ...a, participantes: [...a.participantes, { user_id: null, setor_id: null, tipo_participante: 'usuario', papel: '' }]
      } : a)
    } : e))
  }

  function updateParticipanteAtividade(eIdx: number, aIdx: number, pIdx: number, field: string, value: any) {
    setEntregas(prev => prev.map((e, i) => i === eIdx ? {
      ...e, atividades: e.atividades.map((a, j) => j === aIdx ? {
        ...a, participantes: a.participantes.map((p, k) => k === pIdx ? { ...p, [field]: value } : p)
      } : a)
    } : e))
  }

  function removeParticipanteAtividade(eIdx: number, aIdx: number, pIdx: number) {
    setEntregas(prev => prev.map((e, i) => i === eIdx ? {
      ...e, atividades: e.atividades.map((a, j) => j === aIdx ? {
        ...a, participantes: a.participantes.filter((_, k) => k !== pIdx)
      } : a)
    } : e))
  }

  function toggleAcao(acaoId: number) {
    setAcoesSelecionadas(prev =>
      prev.includes(acaoId) ? prev.filter(id => id !== acaoId) : [...prev, acaoId])
  }

  async function handleSave() {
    if (savingRef.current) return
    savingRef.current = true

    if (!nome.trim() || !descricao.trim() || !problemaResolve.trim() || !causas.trim() || !consequenciasDiretas.trim() || !objetivos.trim() || !setorLiderId || acoesSelecionadas.length === 0) {
      alert('Preencha todos os campos obrigatórios e selecione ao menos uma ação estratégica.')
      savingRef.current = false; return
    }
    for (const e of entregas) {
      if (!e.nome.trim() || !e.descricao.trim() || !e.criterios_aceite.trim()) {
        alert('Preencha nome, descrição e critérios de aceite de todas as entregas.')
        savingRef.current = false; return
      }
      const validParticipantes = e.participantes.filter(p => p.papel.trim())
      if (validParticipantes.length === 0) {
        alert(`A entrega "${e.nome}" precisa de ao menos um participante com papel definido.`)
        savingRef.current = false; return
      }
      // Check duplicate setores in entrega
      const keys = validParticipantes.map(p => p.tipo_participante === 'setor' ? `s_${p.setor_id}` : p.tipo_participante)
      if (new Set(keys).size !== keys.length) {
        alert(`A entrega "${e.nome}" tem setores/participantes duplicados. Use o campo "papel" para múltiplos papéis do mesmo setor.`)
        savingRef.current = false; return
      }
      for (const a of e.atividades) {
        if (!a.nome.trim() || !a.descricao.trim()) {
          alert('Preencha nome e descrição de todas as atividades.')
          savingRef.current = false; return
        }
        // Check atividade date <= entrega quinzena
        if (a.data_prevista && e.quinzena && a.data_prevista > e.quinzena) {
          alert(`A atividade "${a.nome}" tem data posterior à quinzena da entrega "${e.nome}".`)
          savingRef.current = false; return
        }
        // Check atividade participantes: setor do usuário deve estar nos participantes da entrega
        const entregaSetorIds = new Set(validParticipantes.filter(p => p.tipo_participante === 'setor' && p.setor_id).map(p => p.setor_id))
        const ativValidP = a.participantes.filter(p => p.papel.trim())
        for (const ap of ativValidP) {
          if (ap.tipo_participante === 'usuario' && ap.user_id) {
            const u = eligibleUsers.find(u => u.id === ap.user_id)
            if (u?.setor_id && !entregaSetorIds.has(u.setor_id)) {
              alert(`A atividade "${a.nome}" inclui o participante "${u.nome}" cujo setor não está na entrega "${e.nome}".`)
              savingRef.current = false; return
            }
          }
        }
        // Check duplicate users in atividade
        const aKeys = ativValidP.map(p => p.tipo_participante === 'usuario' ? `u_${p.user_id}` : p.tipo_participante)
        if (new Set(aKeys).size !== aKeys.length) {
          alert(`A atividade "${a.nome}" tem participantes duplicados.`)
          savingRef.current = false; return
        }
      }
    }

    if (!responsavelId) {
      alert('Selecione o líder do projeto.')
      savingRef.current = false; return
    }
    for (const e of entregas) {
      if (e.responsavel_entrega_id && !e.orgao_responsavel_setor_id) {
        alert(`A entrega "${e.nome}" tem responsável mas sem órgão responsável definido. Selecione o órgão responsável.`)
        savingRef.current = false; return
      }
      if (!e.responsavel_entrega_id) {
        alert(`Selecione o responsável pela entrega "${e.nome}".`)
        savingRef.current = false; return
      }
      if (e.responsavel_entrega_id && e.orgao_responsavel_setor_id) {
        const respUser = eligibleUsers.find(u => u.id === e.responsavel_entrega_id)
        if (respUser && respUser.setor_id !== e.orgao_responsavel_setor_id) {
          alert(`O responsável pela entrega "${e.nome}" não pertence ao órgão responsável selecionado.`)
          savingRef.current = false; return
        }
      }
      for (const a of e.atividades) {
        if (!a.responsavel_atividade_id) {
          alert(`Selecione o responsável pela atividade "${a.nome}".`)
          savingRef.current = false; return
        }
      }
    }
    if (dataInicio) {
      for (const e of entregas) {
        if (e.quinzena && e.quinzena < dataInicio) {
          alert(`A entrega "${e.nome}" tem prazo anterior à data de início do projeto.`)
          savingRef.current = false; return
        }
        for (const a of e.atividades) {
          if (a.data_prevista && a.data_prevista < dataInicio) {
            alert(`A atividade "${a.nome}" tem data anterior à data de início do projeto.`)
            savingRef.current = false; return
          }
        }
      }
    }

    // Validate indicador nome required
    const indicadoresComDados = indicadores.filter(i => i.nome || i.formula || i.fonte_dados || i.periodicidade || i.unidade_medida || i.responsavel || i.meta)
    if (indicadoresComDados.some(i => !i.nome?.trim())) {
      alert('Preencha o campo "Nome" de todos os indicadores.')
      savingRef.current = false; return
    }

    // Validate risco natureza required
    const riscosComDados = riscos.filter(r => r.natureza || r.probabilidade || r.impacto || r.medida_resposta)
    if (riscosComDados.some(r => !r.natureza?.trim())) {
      alert('Preencha o campo "Natureza" de todos os riscos.')
      savingRef.current = false; return
    }

    // Validate gestor setor restrictions
    if (!isAdminOrMaster) {
      for (const e of entregas) {
        const validP = e.participantes.filter(p => p.papel.trim())
        for (const p of validP) {
          if (p.tipo_participante === 'setor' && p.setor_id !== profile?.setor_id) {
            alert('Gestores só podem designar membros do próprio setor. Para designar outros setores ou pessoas, entre em contato com o Gabinete de Projetos.')
            savingRef.current = false; return
          }
        }
        if (e.orgao_responsavel_setor_id && e.orgao_responsavel_setor_id !== profile?.setor_id) {
          alert('Gestores só podem designar membros do próprio setor. Para designar outros setores ou pessoas, entre em contato com o Gabinete de Projetos.')
          savingRef.current = false; return
        }
      }
    }

    setSaving(true)
    try {
      // Criação completa via PostgreSQL Docker (projeto + entregas + atividades + audit + alertas)
      const entregasPayload = entregas.map(e => ({
        nome: e.nome.trim(),
        descricao: e.descricao.trim(),
        criterios_aceite: e.criterios_aceite.trim(),
        dependencias_criticas: e.dependencias_criticas.trim() || null,
        data_final_prevista: e.quinzena || null,
        status: e.status,
        motivo_status: e.motivo_status.trim() || null,
        orgao_responsavel_setor_id: e.orgao_responsavel_setor_id || null,
        responsavel_entrega_id: e.responsavel_entrega_id || null,
        resultado_descricao: e.resultado_descricao.trim() || null,
        participantes: e.participantes.filter(p => p.papel.trim()),
        atividades: e.atividades.map(a => ({
          nome: a.nome.trim(),
          descricao: a.descricao.trim(),
          data_prevista: a.data_prevista || null,
          status: a.status,
          motivo_status: a.motivo_status.trim() || null,
          responsavel_atividade_id: a.responsavel_atividade_id || null,
          resultado_descricao: a.resultado_descricao.trim() || null,
          participantes: a.participantes.filter((p: any) => p.papel.trim()),
        })),
      }))

      const res = await fetch('/api/dados/projeto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          descricao: descricao.trim(),
          problema_resolve: problemaResolve.trim(),
          causas: causas.trim(),
          consequencias_diretas: consequenciasDiretas.trim(),
          objetivos: objetivos.trim(),
          setor_lider_id: setorLiderId,
          responsavel_id: responsavelId,
          data_inicio: dataInicio || null,
          dependencias_projetos: dependenciasProjetos.trim() || null,
          tipo_acao: tipoAcao.length > 0 ? tipoAcao : null,
          indicador_sucesso: null,
          acoes_ids: acoesSelecionadas,
          indicadores: indicadores.filter(i => i.nome),
          riscos: riscos.filter(r => r.natureza),
          entregas: entregasPayload,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao salvar projeto.')
      }
      const result = await res.json()
      router.push(`/dashboard/projetos/${result.id}`)
    } catch (err: any) {
      alert(`Erro ao salvar: ${err.message}`)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  // Helper: key de um participante para comparação
  function pKey(p: Participante) {
    return p.tipo_participante === 'setor' ? `s_${p.setor_id}` : p.tipo_participante
  }

  // Participante select para ENTREGA (todos os setores, sem duplicados)
  function renderEntregaParticipanteSelect(p: Participante, idx: number, allParts: Participante[], onChange: (field: string, value: any) => void, onRemove: () => void) {
    const usedKeys = new Set(allParts.filter((_, i) => i !== idx).map(pKey))
    return (
      <div className="flex gap-2 items-start">
        <select value={p.tipo_participante === 'setor' ? (p.setor_id || '') : p.tipo_participante}
          onChange={e => {
            const v = e.target.value
            if (v === 'externo_subsegop' || v === 'externo_sedec') {
              onChange('tipo_participante', v); onChange('setor_id', null)
            } else {
              onChange('tipo_participante', 'setor'); onChange('setor_id', parseInt(v) || null)
            }
          }} className="input-field text-xs flex-1">
          <option value="">Selecione o participante...</option>
          <optgroup label="Setores">
            {setoresDisponiveis.map(s => (
              <option key={s.id} value={s.id} disabled={usedKeys.has(`s_${s.id}`)}>{s.codigo} — {s.nome_completo}{usedKeys.has(`s_${s.id}`) ? ' (já incluído)' : ''}</option>
            ))}
          </optgroup>
          <optgroup label="Atores Externos">
            <option value="externo_subsegop" disabled={usedKeys.has('externo_subsegop')}>Ator externo à SUBSEGOP{usedKeys.has('externo_subsegop') ? ' (já incluído)' : ''}</option>
            <option value="externo_sedec" disabled={usedKeys.has('externo_sedec')}>Ator externo à SEDEC{usedKeys.has('externo_sedec') ? ' (já incluído)' : ''}</option>
          </optgroup>
        </select>
        <input type="text" value={p.papel} onChange={e => onChange('papel', e.target.value)}
          placeholder="Papel (use este campo para múltiplos papéis)" className="input-field text-xs flex-1" />
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 mt-2 shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  // Participante select para ATIVIDADE (usuários cujo setor está na entrega)
  function renderAtividadeParticipanteSelect(p: AtivParticipante, idx: number, allParts: AtivParticipante[], entregaParts: Participante[], onChange: (field: string, value: any) => void, onRemove: () => void) {
    const usedUserIds = new Set(allParts.filter((_, i) => i !== idx).filter(ap => ap.user_id).map(ap => ap.user_id))
    const entregaSetorIds = new Set(entregaParts.filter(ep => ep.tipo_participante === 'setor' && ep.setor_id && ep.papel.trim()).map(ep => ep.setor_id))
    // Filtrar usuários: gestor só vê seu próprio setor; admin/master vê setores da entrega
    const filteredUsers = eligibleUsers.filter(u => {
      if (usedUserIds.has(u.id)) return false
      if (!isAdminOrMaster) {
        return u.setor_id === profile?.setor_id
      }
      if (entregaSetorIds.size === 0) return false
      return u.setor_id ? entregaSetorIds.has(u.setor_id) : false
    })
    const selectedUser = p.user_id ? eligibleUsers.find(u => u.id === p.user_id) : null
    return (
      <div className="flex gap-2 items-start">
        <div className="flex-1 min-w-0">
          <UserAutocompleteSelect
            value={p.user_id}
            onChange={userId => {
              const u = userId ? eligibleUsers.find(u => u.id === userId) : null
              onChange('user_id', userId)
              onChange('setor_id', u?.setor_id || null)
              onChange('tipo_participante', 'usuario')
            }}
            users={p.user_id && selectedUser ? [selectedUser, ...filteredUsers] : filteredUsers}
            placeholder="Selecione o participante..."
            onRegisterNew={() => setShowGestorModal(['gestor', 'usuario'])}
            registerNewLabel="Cadastrar novo usuário"
          />
        </div>
        {selectedUser?.setor_codigo && (
          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-2 rounded mt-0.5 shrink-0 font-medium">
            {selectedUser.setor_codigo}
          </span>
        )}
        <input type="text" value={p.papel} onChange={e => onChange('papel', e.target.value)}
          placeholder="Papel na atividade" className="input-field text-xs flex-1" />
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 mt-2 shrink-0">
          <Trash2 size={14} />
        </button>
      </div>
    )
  }

  // Validação cruzada: ao alterar quinzena da entrega, checar se atividades ficam inválidas
  function handleQuinzenaChange(eIdx: number, newQuinzena: string) {
    const entrega = entregas[eIdx]
    if (newQuinzena) {
      if (dataInicio && newQuinzena < dataInicio) {
        alert(`A quinzena não pode ser anterior à data de início do projeto (${dataInicio}).`)
        return
      }
      const ativComDataPosterior = entrega.atividades.filter(a => a.data_prevista && a.data_prevista > newQuinzena)
      if (ativComDataPosterior.length > 0) {
        const nomes = ativComDataPosterior.map(a => `"${a.nome}"`).join(', ')
        alert(`Não é possível definir esta quinzena. As atividades ${nomes} têm datas posteriores. Ajuste-as primeiro.`)
        return
      }
    }
    updateEntrega(eIdx, 'quinzena', newQuinzena)
  }

  // Validação cruzada: ao remover participante de entrega, checar se está em alguma atividade
  function handleRemoveParticipanteEntrega(eIdx: number, pIdx: number) {
    const entrega = entregas[eIdx]
    const removendo = entrega.participantes[pIdx]
    const rKey = pKey(removendo)
    // Checar atividades com participantes tipo 'usuario' cujo setor corresponda ao setor sendo removido
    const ativComEsseSetor = entrega.atividades.filter(a =>
      a.participantes.some(ap => {
        if (ap.tipo_participante === 'usuario' && ap.user_id && removendo.tipo_participante === 'setor') {
          return ap.setor_id === removendo.setor_id
        }
        return pKey(ap as any) === rKey
      })
    )
    if (ativComEsseSetor.length > 0) {
      const nomes = ativComEsseSetor.map(a => `"${a.nome}"`).join(', ')
      alert(`Não é possível remover este participante. Ele está incluído nas atividades: ${nomes}. Remova-o das atividades primeiro.`)
      return
    }
    // Limpar órgão responsável se era este participante
    if (removendo.tipo_participante === 'setor' && removendo.setor_id === entrega.orgao_responsavel_setor_id) {
      updateEntrega(eIdx, 'orgao_responsavel_setor_id', null)
    }
    removeParticipanteEntrega(eIdx, pIdx)
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-pulse text-sedec-500">Carregando...</div></div>

  return (
    <div className="max-w-4xl mx-auto">
      <ProjectGuidelineModal isOpen={modalOpen} onClose={() => setModalOpen(false)} showCheckbox={modalShowCheckbox} />
      <HelpTooltipModal type={helpType} onClose={() => setHelpType(null)} userRole={profile?.role} />
      <button onClick={() => router.push('/dashboard/projetos')}
        className="flex items-center gap-2 text-sm text-sedec-500 hover:text-sedec-700 mb-4">
        <ArrowLeft size={16} /> Voltar aos projetos
      </button>

      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex-1">
          <div className="w-full pr-4">
            <h1 className="text-2xl font-bold text-gray-800 inline leading-tight align-middle">Novo Projeto</h1>
            <button type="button" onClick={() => setHelpType('projeto')} className="inline-flex align-middle ml-2 text-gray-400 hover:text-orange-500 transition-colors" title="O que é um Projeto?">
              <HelpCircle size={20} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 shrink-0 items-center">
          <button type="button" onClick={openHelpModal}
            className="flex items-center gap-1.5 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1.5 rounded-lg hover:bg-orange-100 transition-colors"
            title="Guia de preenchimento">
            <BookOpen size={14} /> Guia
          </button>
          <button type="button" onClick={() => setHelpType('permissoes')} className="flex items-center gap-1.5 text-xs text-sedec-500 hover:text-sedec-700 bg-sedec-50 hover:bg-sedec-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium border border-sedec-200" title="Regras de permissão">
            <HelpCircle size={14} /> Permissões
          </button>
        </div>
      </div>

      <div className="mb-6">
        <AIAssistantsCard />
      </div>

      <div className="space-y-6">
        {/* Dados do projeto */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-bold text-gray-800">Dados do Projeto</h2>
            <p className="text-xs text-gray-500 mt-1">Preencha as informações básicas para iniciar o escopo do projeto.</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nome do projeto <span className="text-red-500">*</span></label>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-700"
                  placeholder="Nome claro e objetivo" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Setor líder <span className="text-red-500">*</span></label>
                {profile?.role === 'gestor' ? (
                  <div className="w-full px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 font-medium">
                    {setores.find(s => s.id === profile.setor_id)?.codigo || ''} — {setores.find(s => s.id === profile.setor_id)?.nome_completo || ''}
                  </div>
                ) : (
                  <select value={setorLiderId} onChange={e => { setSetorLiderId(parseInt(e.target.value) || ''); setResponsavelId(null) }}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-700 bg-white">
                    <option value="">Selecione o setor líder...</option>
                    {setoresDisponiveis.map(s => <option key={s.id} value={s.id}>{s.codigo} — {s.nome_completo}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Líder do projeto *</label>
                <UserAutocompleteSelect
                  value={responsavelId}
                  onChange={setResponsavelId}
                  users={eligibleUsers.filter(u => u.role !== 'usuario' && u.setor_id === setorLiderId)}
                  placeholder="Selecione o líder do projeto..."
                  required
                  onRegisterNew={() => setShowGestorModal(['gestor'])}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data de início do projeto</label>
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-700" />
                <p className="text-xs text-gray-400 mt-1">Opcional. Entregas e atividades não poderão ter datas anteriores a esta.</p>
              </div>
            </div>

            <hr className="border-gray-100" />

            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Problema Identificado — POR QUE o projeto existe <span className="text-red-500">*</span></label>
                  <button type="button" onClick={() => setHelpType('campo_problema')} className="text-gray-400 hover:text-orange-500 transition-colors" title="Ver ajuda sobre este campo">
                    <HelpCircle size={15} />
                  </button>
                </div>
                <textarea value={problemaResolve} onChange={e => setProblemaResolve(e.target.value)} rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-700 resize-y leading-relaxed"
                  placeholder={'Descreva a situação atual que impacta negativamente os resultados do setor ou o cumprimento da missão institucional. Foque no problema em si — não em suas causas, não em como resolvê-lo. Ex.: "Comunidades em áreas de risco apresentam alta vulnerabilidade a desastres."'} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Causas do Problema — O QUE origina essa situação <span className="text-red-500">*</span></label>
                  <button type="button" onClick={() => setHelpType('campo_causas')} className="text-gray-400 hover:text-orange-500 transition-colors" title="Ver ajuda sobre este campo">
                    <HelpCircle size={15} />
                  </button>
                </div>
                <textarea value={causas} onChange={e => setCausas(e.target.value)} rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-700 resize-y leading-relaxed"
                  placeholder={'Liste os fatores que geram ou agravam o problema identificado. Separe as causas por ponto e vírgula ou em linhas distintas. Ex.: "Baixa percepção de risco pelos moradores; ausência de cultura de preparação individual; falta de canais acessíveis de informação sobre riscos locais."'} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Consequências Diretas do Problema — O QUE acontece por causa dele <span className="text-red-500">*</span></label>
                  <button type="button" onClick={() => setHelpType('campo_consequencias')} className="text-gray-400 hover:text-orange-500 transition-colors" title="Ver ajuda sobre este campo">
                    <HelpCircle size={15} />
                  </button>
                </div>
                <textarea value={consequenciasDiretas} onChange={e => setConsequenciasDiretas(e.target.value)} rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-700 resize-y leading-relaxed"
                  placeholder={'Descreva os impactos imediatos que decorrem diretamente do problema, sem depender de uma cadeia de eventos intermediários. Ex.: "Moradores permanecem em áreas de risco mesmo após emissão de alertas; famílias não adotam medidas básicas de autoproteção."'} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Objetivo do Projeto — PARA QUE ele existe <span className="text-red-500">*</span></label>
                  <button type="button" onClick={() => setHelpType('campo_objetivo')} className="text-gray-400 hover:text-orange-500 transition-colors" title="Ver ajuda sobre este campo">
                    <HelpCircle size={15} />
                  </button>
                </div>
                <textarea value={objetivos} onChange={e => setObjetivos(e.target.value)} rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-700 resize-y leading-relaxed"
                  placeholder={'Declare a transformação concreta que o projeto pretende alcançar ao atuar sobre as causas identificadas. Ex.: "Aumentar a percepção de risco em comunidades vulneráveis, reduzindo comportamentos que elevam sua exposição a situações de desastre."'} />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Descrição da Solução Proposta — O QUE será feito <span className="text-red-500">*</span></label>
                  <button type="button" onClick={() => setHelpType('campo_descricao')} className="text-gray-400 hover:text-orange-500 transition-colors" title="Ver ajuda sobre este campo">
                    <HelpCircle size={15} />
                  </button>
                </div>
                <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={4}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-700 resize-y leading-relaxed"
                  placeholder={'Descreva a intervenção institucional que o projeto representa — ou seja, o que será feito para alcançar o objetivo declarado e atuar sobre as causas identificadas. Ex.: "Implantação de programa estruturado de educação comunitária em gestão de riscos, com metodologia replicável e integração com as redes de defesa civil municipal."'} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <label className="block text-sm font-semibold text-gray-700">Indicador(es) de sucesso - Como saberemos que funcionou?</label>
                  </div>
                  <button type="button" onClick={() => setIndicadores([...indicadores, { nome: '', formula: '', fonte_dados: '', periodicidade: '', unidade_medida: '', responsavel: '', meta: '' }])}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                    <Plus size={14} /> Indicador
                  </button>
                </div>
                {indicadores.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Nenhum indicador adicionado. Clique em &quot;+ Indicador&quot; para adicionar.</p>
                )}
                <div className="space-y-3">
                  {indicadores.map((ind, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 relative">
                      <button type="button" onClick={() => setIndicadores(indicadores.filter((_, i) => i !== idx))}
                        className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors" title="Remover indicador">
                        <Trash2 size={16} />
                      </button>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Indicador {idx + 1}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <label className="text-xs text-gray-500">Nome <span className="text-red-500">*</span></label>
                            <button type="button" onClick={() => setHelpType('campo_ind_nome')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                          </div>
                          <input type="text" value={ind.nome} onChange={e => setIndicadores(indicadores.map((item, i) => i === idx ? { ...item, nome: e.target.value } : item))}
                            className="input-field text-sm" placeholder='Ex.: "Percentual de moradores capacitados em autoproteção"' />
                        </div>
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <label className="text-xs text-gray-500">Fórmula de Cálculo</label>
                            <button type="button" onClick={() => setHelpType('campo_ind_formula')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                          </div>
                          <input type="text" value={ind.formula} onChange={e => setIndicadores(indicadores.map((item, i) => i === idx ? { ...item, formula: e.target.value } : item))}
                            className="input-field text-sm" placeholder='Ex.: "(Nº capacitados ÷ total da área-alvo) × 100"' />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <label className="text-xs text-gray-500">Fonte de Dados</label>
                            <button type="button" onClick={() => setHelpType('campo_ind_fonte')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                          </div>
                          <input type="text" value={ind.fonte_dados} onChange={e => setIndicadores(indicadores.map((item, i) => i === idx ? { ...item, fonte_dados: e.target.value } : item))}
                            className="input-field text-sm" placeholder='Ex.: "Lista de presença", "Sistema SISGEO"' />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <label className="text-xs text-gray-500">Periodicidade/Frequência</label>
                            <button type="button" onClick={() => setHelpType('campo_ind_periodicidade')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                          </div>
                          <input type="text" value={ind.periodicidade} onChange={e => setIndicadores(indicadores.map((item, i) => i === idx ? { ...item, periodicidade: e.target.value } : item))}
                            className="input-field text-sm" placeholder='Ex.: "Mensal", "Trimestral", "Ao final de cada entrega"' />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <label className="text-xs text-gray-500">Unidade de Medida</label>
                            <button type="button" onClick={() => setHelpType('campo_ind_unidade')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                          </div>
                          <input type="text" value={ind.unidade_medida} onChange={e => setIndicadores(indicadores.map((item, i) => i === idx ? { ...item, unidade_medida: e.target.value } : item))}
                            className="input-field text-sm" placeholder='Ex.: "Percentual (%)", "Número absoluto", "R$"' />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <label className="text-xs text-gray-500">Responsável</label>
                            <button type="button" onClick={() => setHelpType('campo_ind_responsavel')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                          </div>
                          <input type="text" value={ind.responsavel} onChange={e => setIndicadores(indicadores.map((item, i) => i === idx ? { ...item, responsavel: e.target.value } : item))}
                            className="input-field text-sm" placeholder='Ex.: "Coordenador de capacitação do setor X"' />
                        </div>
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <label className="text-xs text-gray-500">Meta</label>
                            <button type="button" onClick={() => setHelpType('campo_ind_meta')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                          </div>
                          <input type="text" value={ind.meta} onChange={e => setIndicadores(indicadores.map((item, i) => i === idx ? { ...item, meta: e.target.value } : item))}
                            className="input-field text-sm" placeholder='Ex.: "Atingir 70% de moradores capacitados até dez/2026"' />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <label className="block text-sm font-semibold text-gray-700">Matriz de Riscos</label>
                  </div>
                  <button type="button" onClick={() => setRiscos([...riscos, { natureza: '', probabilidade: '', impacto: '', medida_resposta: '' }])}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                    <Plus size={14} /> Risco
                  </button>
                </div>
                {riscos.length === 0 && (
                  <p className="text-xs text-gray-400 italic">Nenhum risco adicionado. Clique em &quot;+ Risco&quot; para adicionar.</p>
                )}
                <div className="space-y-3">
                  {riscos.map((risco, idx) => (
                    <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-4 relative">
                      <button type="button" onClick={() => setRiscos(riscos.filter((_, i) => i !== idx))}
                        className="absolute top-3 right-3 text-red-400 hover:text-red-600 transition-colors" title="Remover risco">
                        <Trash2 size={16} />
                      </button>
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Risco {idx + 1}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <label className="text-xs text-gray-500">Natureza — O que pode acontecer <span className="text-red-500">*</span></label>
                            <button type="button" onClick={() => setHelpType('campo_risco_natureza')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                          </div>
                          <textarea value={risco.natureza} onChange={e => setRiscos(riscos.map((item, i) => i === idx ? { ...item, natureza: e.target.value } : item))}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-gray-700 resize-y leading-relaxed" rows={2}
                            placeholder='Ex.: "Indisponibilidade de servidores capacitados para as atividades de campo"' />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <label className="text-xs text-gray-500">Probabilidade</label>
                            <button type="button" onClick={() => setHelpType('campo_risco_probabilidade')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                          </div>
                          <select value={risco.probabilidade} onChange={e => setRiscos(riscos.map((item, i) => i === idx ? { ...item, probabilidade: e.target.value } : item))}
                            className="input-field text-sm">
                            <option value="">Selecione...</option>
                            <option value="baixa">Baixa</option>
                            <option value="media">Média</option>
                            <option value="alta">Alta</option>
                          </select>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <label className="text-xs text-gray-500">Impacto</label>
                            <button type="button" onClick={() => setHelpType('campo_risco_impacto')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                          </div>
                          <select value={risco.impacto || ''} onChange={e => setRiscos(riscos.map((item, i) => i === idx ? { ...item, impacto: e.target.value } : item))}
                            className="input-field text-sm">
                            <option value="">Selecione...</option>
                            <option value="baixo">Baixo</option>
                            <option value="medio">Médio</option>
                            <option value="alto">Alto</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <label className="text-xs text-gray-500">Medida de Resposta — Como reduzir, contornar ou mitigar</label>
                            <button type="button" onClick={() => setHelpType('campo_risco_medida')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                          </div>
                          <textarea value={risco.medida_resposta} onChange={e => setRiscos(riscos.map((item, i) => i === idx ? { ...item, medida_resposta: e.target.value } : item))}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-gray-700 resize-y leading-relaxed" rows={2}
                            placeholder='Ex.: "Identificar e capacitar servidores de outros setores como alternativa; firmar acordo com órgão parceiro"' />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-sm font-semibold text-gray-700">Dependências críticas do projeto</label>
                  <button type="button" onClick={() => setHelpType('campo_dependencias')} className="text-gray-400 hover:text-orange-500 transition-colors" title="Ver ajuda sobre este campo">
                    <HelpCircle size={15} />
                  </button>
                </div>
                <textarea value={dependenciasProjetos} onChange={e => setDependenciasProjetos(e.target.value)} rows={2}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-gray-700 resize-y leading-relaxed"
                  placeholder={'Descreva dependências críticas deste projeto: outros projetos, aprovações orçamentárias, decisões normativas, disponibilidade de recursos, fornecedores externos etc. Ex.: "Depende da conclusão do Projeto X para acesso ao sistema Y; aguarda liberação de crédito orçamentário para aquisição de equipamentos"'} />
              </div>
            </div>

            <hr className="border-gray-100" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ações estratégicas vinculadas <span className="text-red-500">*</span></label>
                <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-gray-50/50">
                  {acoes.map(a => (
                    <label key={a.id} className="flex items-start gap-3 text-sm p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 hover:shadow-sm cursor-pointer transition-all">
                      <input type="checkbox" checked={acoesSelecionadas.includes(a.id)}
                        onChange={() => toggleAcao(a.id)} className="mt-0.5 rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                      <div>
                        <span className="font-bold text-sedec-600 block">AE {a.numero}</span>
                        <span className="text-gray-600 leading-snug">{a.nome}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de ação</label>
                <div className="flex flex-wrap gap-2 border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                  {TIPOS_ACAO.map(tipo => (
                    <label key={tipo} className="flex items-center gap-2 text-sm bg-white border border-gray-200 px-3 py-1.5 rounded-lg cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition-all">
                      <input type="checkbox" checked={tipoAcao.includes(tipo)} onChange={() => toggleTipoAcao(tipo)}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                      <span className="text-gray-700 font-medium">{tipo}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Entregas */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-gray-700">Entregas</h2>
              <button type="button" onClick={() => setHelpType('entrega')} className="text-gray-400 hover:text-orange-500 transition-colors" title="O que é uma Entrega?">
                <HelpCircle size={15} />
              </button>
            </div>
            <button type="button" onClick={addEntrega}
              className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium">
              <PackagePlus size={16} /> Adicionar entrega
            </button>
          </div>

          {entregas.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Nenhuma entrega adicionada. Entregas podem ser adicionadas agora ou posteriormente.</p>
          )}

          <div className="space-y-6">
            {entregas.map((e, eIdx) => (
              <div key={eIdx} className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-600">Entrega {eIdx + 1}</span>
                  <button type="button" onClick={() => removeEntrega(eIdx)}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                    title="Remover esta entrega">
                    <Trash2 size={14} /> Remover
                  </button>
                </div>

                <div className="space-y-3">
                  <input type="text" value={e.nome} onChange={ev => updateEntrega(eIdx, 'nome', ev.target.value)}
                    placeholder="Nome da entrega *" className="input-field text-sm" />
                  <textarea value={e.descricao} onChange={ev => updateEntrega(eIdx, 'descricao', ev.target.value)}
                    placeholder="Descrição da entrega *" className="input-field text-sm resize-y" rows={2} />
                  <div>
                    <label className="text-xs font-medium text-gray-500">Critérios de aceite <span className="text-red-500">*</span></label>
                    <input type="text" value={e.criterios_aceite} onChange={ev => updateEntrega(eIdx, 'criterios_aceite', ev.target.value)}
                      placeholder="ex: Minuta apresentada e aprovada pelo Superintendente" className="input-field text-sm" />
                  </div>

                  {/* Participantes */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">Participantes <span className="text-red-500">*</span></span>
                      <button type="button" onClick={() => addParticipanteEntrega(eIdx)}
                        className="text-[11px] text-orange-500 hover:text-orange-700 font-medium">+ Participante</button>
                    </div>
                    <div className="space-y-2">
                      {e.participantes.map((p, pIdx) => (
                        <div key={pIdx}>
                          {renderEntregaParticipanteSelect(p, pIdx, e.participantes,
                            (f, v) => updateParticipanteEntrega(eIdx, pIdx, f, v),
                            () => handleRemoveParticipanteEntrega(eIdx, pIdx))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Órgão responsável + Responsável */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Órgão responsável *</label>
                      <select
                        value={e.orgao_responsavel_setor_id || ''}
                        onChange={ev => {
                          const newSetorId = ev.target.value ? parseInt(ev.target.value) : null
                          const currentResp = e.responsavel_entrega_id
                          const respUser = currentResp ? eligibleUsers.find(u => u.id === currentResp) : null
                          const shouldClear = currentResp && newSetorId && respUser && respUser.setor_id !== newSetorId
                          const updated = [...entregas]
                          updated[eIdx] = { ...updated[eIdx], orgao_responsavel_setor_id: newSetorId, ...(shouldClear ? { responsavel_entrega_id: null } : {}) }
                          setEntregas(updated)
                        }}
                        className="input-field text-xs">
                        <option value="">Selecione...</option>
                        {setoresDisponiveis.map(s => (
                          <option key={s.id} value={s.id}>{s.codigo} — {s.nome_completo}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Responsável pela entrega *</label>
                      {!e.orgao_responsavel_setor_id ? (
                        <p className="text-[10px] text-gray-400 mt-1 italic px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">Selecione o órgão responsável primeiro.</p>
                      ) : (
                        <UserAutocompleteSelect
                          value={e.responsavel_entrega_id}
                          onChange={val => {
                            const updated = [...entregas]
                            updated[eIdx].responsavel_entrega_id = val
                            setEntregas(updated)
                          }}
                          users={eligibleUsers.filter(u => u.role !== 'usuario' && (u.id === e.responsavel_entrega_id || u.setor_id === e.orgao_responsavel_setor_id))}
                          placeholder="Selecione o responsável..."
                          required
                          onRegisterNew={() => setShowGestorModal(['gestor'])}
                        />
                      )}
                    </div>
                  </div>

                  {/* Status + Quinzena + Motivo */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[160px]">
                        <label className="text-xs font-medium text-gray-500">Status</label>
                        <select value={e.status} onChange={ev => updateEntrega(eIdx, 'status', ev.target.value)}
                          className={`w-full px-3 py-2 rounded-lg text-xs font-medium border-2 focus:outline-none focus:ring-2 focus:ring-sedec-500 ${e.status === 'resolvida' ? 'border-green-400 bg-green-50 text-green-800' :
                            e.status === 'cancelada' ? 'border-red-300 bg-red-50 text-red-800' :
                              e.status === 'em_andamento' ? 'border-blue-300 bg-blue-50 text-blue-800' :
                                e.status === 'aguardando' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' :
                                  'border-gray-300 bg-white text-gray-700'
                            }`}>
                          {Object.entries(STATUS_ENTREGA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>
                      <div className="w-[180px]">
                        <label className="text-xs font-medium text-gray-500">Quinzena de entrega</label>
                        <select value={e.quinzena} onChange={ev => handleQuinzenaChange(eIdx, ev.target.value)}
                          className="w-full input-field text-xs">
                          <option value="">Sem prazo definido</option>
                          {QUINZENAS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <label className="text-xs font-medium text-gray-500">Motivo do status</label>
                        <input type="text" value={e.motivo_status} onChange={ev => updateEntrega(eIdx, 'motivo_status', ev.target.value)}
                          placeholder="Opcional" className="input-field text-xs" />
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] ${e.status === 'aguardando' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      e.status === 'em_andamento' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                        e.status === 'resolvida' ? 'bg-green-50 text-green-600 border border-green-100' :
                          e.status === 'cancelada' ? 'bg-red-50 text-red-500 border border-red-100' :
                            'bg-gray-50 text-gray-500 border border-gray-100'
                      }`}>
                      <Info size={12} className="shrink-0" />
                      <span>{STATUS_ENTREGA[e.status]?.hint}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500">Dependências críticas</label>
                    <textarea value={e.dependencias_criticas}
                      onChange={ev => updateEntrega(eIdx, 'dependencias_criticas', ev.target.value)}
                      placeholder="ex: custos específicos, tempo de licitação, dependência de ação de algum setor..." className="input-field text-xs resize-y" rows={2} />
                    <p className="text-[10px] text-amber-600 mt-1">Caso haja alguma dependência crítica que dependa de outro setor, ajuste com ele antes de inserí-la.</p>
                  </div>

                  <ResultadosSection
                    owner={null}
                    descricao={e.resultado_descricao}
                    onDescricaoChange={v => updateEntrega(eIdx, 'resultado_descricao', v)}
                    arquivoPath={null}
                    arquivoNome={null}
                    arquivoTamanho={null}
                    onArquivoChange={() => {}}
                    uploadDisabled
                    uploadDisabledMessage="Salve o projeto para anexar o PDF comprobatório."
                  />

                  {/* Atividades */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">Atividades</span>
                        <button type="button" onClick={() => setHelpType('atividade')} className="text-gray-400 hover:text-orange-500 transition-colors" title="O que é uma Atividade?">
                          <HelpCircle size={13} />
                        </button>
                      </div>
                      <button type="button" onClick={() => addAtividade(eIdx)}
                        className="text-[11px] text-orange-500 hover:text-orange-700 font-medium flex items-center gap-1">
                        <ListPlus size={13} /> Atividade
                      </button>
                    </div>

                    {e.atividades.length === 0 && (
                      <div className="flex items-start gap-2 text-xs text-gray-400 bg-white/70 rounded p-2">
                        <Info size={13} className="mt-0.5 shrink-0" />
                        <span>As atividades podem incluir reuniões de brainstorm, pesquisa bibliográfica, levantamento de preços etc. Podem ser adicionadas posteriormente.</span>
                      </div>
                    )}

                    {e.atividades.map((a, aIdx) => (
                      <div key={aIdx} className="bg-white rounded border border-gray-100 p-3 mb-2">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-[11px] font-semibold text-gray-500">Atividade {aIdx + 1}</span>
                          <button type="button" onClick={() => removeAtividade(eIdx, aIdx)}
                            className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                        </div>
                        <div className="space-y-2">
                          <input type="text" value={a.nome} onChange={ev => updateAtividade(eIdx, aIdx, 'nome', ev.target.value)}
                            placeholder="Nome da atividade *" className="input-field text-xs" />
                          <textarea value={a.descricao} onChange={ev => updateAtividade(eIdx, aIdx, 'descricao', ev.target.value)}
                            placeholder="Descrição da atividade *" className="input-field text-xs resize-y" rows={2} />

                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Responsável pela atividade *</label>
                            <UserAutocompleteSelect
                              value={a.responsavel_atividade_id}
                              onChange={val => {
                                const updated = [...entregas]
                                updated[eIdx].atividades[aIdx].responsavel_atividade_id = val
                                setEntregas(updated)
                              }}
                              users={(() => {
                                if (!isAdminOrMaster) {
                                  return eligibleUsers.filter(u => u.role !== 'usuario' && (u.id === a.responsavel_atividade_id || u.setor_id === profile?.setor_id))
                                }
                                const entregaSetorIds = new Set(e.participantes.filter(p => p.tipo_participante === 'setor' && p.setor_id).map(p => p.setor_id))
                                return eligibleUsers.filter(u => u.role !== 'usuario' && (u.id === a.responsavel_atividade_id || (u.setor_id && entregaSetorIds.has(u.setor_id))))
                              })()}
                              placeholder="Selecione o responsável..."
                              required
                              onRegisterNew={() => setShowGestorModal(['gestor'])}
                            />
                          </div>

                          {/* Status + Data prevista + Motivo */}
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="w-[140px]">
                                <label className="text-[10px] font-medium text-gray-500">Status</label>
                                <select value={a.status} onChange={ev => updateAtividade(eIdx, aIdx, 'status', ev.target.value)}
                                  className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium border-2 focus:outline-none focus:ring-2 focus:ring-sedec-500 ${a.status === 'resolvida' ? 'border-green-400 bg-green-50 text-green-800' :
                                    a.status === 'cancelada' ? 'border-red-300 bg-red-50 text-red-800' :
                                      a.status === 'em_andamento' ? 'border-blue-300 bg-blue-50 text-blue-800' :
                                        a.status === 'aguardando' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' :
                                          'border-gray-300 bg-white text-gray-700'
                                    }`}>
                                  {Object.entries(STATUS_ENTREGA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                              </div>
                              <div className="w-[140px]">
                                <label className="text-[10px] font-medium text-gray-500">Data prevista <span className="text-gray-400 font-normal">(prazo para conclusão)</span></label>
                                <input type="date" value={a.data_prevista}
                                  min={dataInicio || undefined}
                                  max={e.quinzena || undefined}
                                  onChange={ev => {
                                    const newDate = ev.target.value
                                    if (newDate && dataInicio && newDate < dataInicio) {
                                      alert(`A data não pode ser anterior à data de início do projeto (${dataInicio}).`)
                                      return
                                    }
                                    if (newDate && e.quinzena && newDate > e.quinzena) {
                                      alert(`A data não pode ser posterior à quinzena da entrega (${e.quinzena}).`)
                                      return
                                    }
                                    updateAtividade(eIdx, aIdx, 'data_prevista', newDate)
                                  }}
                                  className="w-full input-field text-xs" />
                              </div>
                              <div className="flex-1 min-w-[140px]">
                                <label className="text-[10px] font-medium text-gray-500">Motivo</label>
                                <input type="text" value={a.motivo_status} onChange={ev => updateAtividade(eIdx, aIdx, 'motivo_status', ev.target.value)}
                                  placeholder="Opcional" className="input-field text-xs" />
                              </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] ${a.status === 'aguardando' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              a.status === 'em_andamento' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                a.status === 'resolvida' ? 'bg-green-50 text-green-600 border border-green-100' :
                                  a.status === 'cancelada' ? 'bg-red-50 text-red-500 border border-red-100' :
                                    'bg-gray-50 text-gray-500 border border-gray-100'
                              }`}>
                              <Info size={11} className="shrink-0" />
                              <span>{STATUS_ENTREGA[a.status]?.hint}</span>
                            </div>
                          </div>

                          {/* Participantes da atividade (apenas setores da entrega) */}
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-medium text-gray-500">Participantes</span>
                              <button type="button" onClick={() => {
                                const entregaValid = e.participantes.filter(p => p.papel.trim())
                                if (entregaValid.length === 0) { alert('Adicione participantes na entrega primeiro.'); return }
                                addParticipanteAtividade(eIdx, aIdx)
                              }}
                                className="text-[10px] text-orange-500 hover:text-orange-700 font-medium">+ Participante</button>
                            </div>
                            {e.participantes.filter(p => p.papel.trim()).length === 0 && a.participantes.length === 0 && (
                              <p className="text-[9px] text-gray-400 italic">Disponível após incluir participantes na entrega.</p>
                            )}
                            {a.participantes.map((p, pIdx) => (
                              <div key={pIdx} className="mt-1">
                                {renderAtividadeParticipanteSelect(p, pIdx, a.participantes, e.participantes,
                                  (f, v) => updateParticipanteAtividade(eIdx, aIdx, pIdx, f, v),
                                  () => removeParticipanteAtividade(eIdx, aIdx, pIdx))}
                              </div>
                            ))}
                          </div>

                          <ResultadosSection
                            owner={null}
                            descricao={a.resultado_descricao}
                            onDescricaoChange={v => updateAtividade(eIdx, aIdx, 'resultado_descricao', v)}
                            arquivoPath={null}
                            arquivoNome={null}
                            arquivoTamanho={null}
                            onArquivoChange={() => {}}
                            uploadDisabled
                            uploadDisabledMessage="Salve o projeto para anexar o PDF comprobatório."
                            compact
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.push('/dashboard/projetos')}
            className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            <Save size={16} /> {saving ? 'Salvando...' : 'Criar projeto'}
          </button>
        </div>
      </div>

      <RegisterGestorModal
        isOpen={!!showGestorModal}
        onClose={() => setShowGestorModal(false)}
        onSuccess={(newUser) => {
          setEligibleUsers(prev => [...prev, newUser].sort((a, b) => a.nome.localeCompare(b.nome)))
          setShowGestorModal(false)
        }}
        setores={setores}
        allowedRoles={showGestorModal || ['gestor']}
      />
    </div>
  )
}
