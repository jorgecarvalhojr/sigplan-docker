'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Edit3, Trash2, Save, X, Plus, PackagePlus, ListPlus,
  CheckCircle, CheckCircle2, XCircle, Clock, AlertTriangle, Info, ChevronDown, ChevronUp, HelpCircle, Pause, BookOpen, Sparkles, FileText
} from 'lucide-react'
import ProjectGuidelineModal from '@/components/ProjectGuidelineModal'
import AIAssistantsCard from '@/components/AIAssistantsCard'
import ResultadosSection from '@/components/ResultadosSection'
import HelpTooltipModal, { HelpType } from '@/components/HelpTooltipModal'
import UserAutocompleteSelect from '@/components/UserAutocompleteSelect'
import RegisterGestorModal from '@/components/RegisterGestorModal'
import ProjetoMensagens from '@/components/ProjetoMensagens'
import type { Profile } from '@/lib/types'
import { sendPushForAlerts } from '@/lib/push-client'

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

const PONT_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  em_dia: { label: 'Em dia', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-300', icon: CheckCircle },
  proximo: { label: 'Próximo do prazo', color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300', icon: Clock },
  atrasado: { label: 'Atrasado', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', icon: AlertTriangle },
  concluido: { label: 'Concluído', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'text-gray-500', bg: 'bg-gray-100', border: 'border-gray-300', icon: XCircle },
  hibernando: { label: 'Hibernando', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-300', icon: Pause },
}

export default function ProjetoDetalhePage() {
  const params = useParams()
  const id = parseInt(params.id as string)
  const router = useRouter()

  const [projeto, setProjeto] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [setores, setSetores] = useState<any[]>([])
  const [acoes, setAcoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const formatDateBR = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const partes = dateStr.includes('T') ? dateStr.split('T')[0].split('-') : dateStr.split('-')
    if (partes.length !== 3) return dateStr
    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }

  // Edit states
  const [editingProjeto, setEditingProjeto] = useState(false)
  const [editingEntrega, setEditingEntrega] = useState<number | null>(null)
  const [editingAtividade, setEditingAtividade] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [solicitacoes, setSolicitacoes] = useState<any[]>([])
  const [helpType, setHelpType] = useState<HelpType>(null)
  const [showNewEntregaForm, setShowNewEntregaForm] = useState(false)
  const [newEntregaForm, setNewEntregaForm] = useState<any>({})
  const [allExpanded, setAllExpanded] = useState(false)

  const [eligibleUsers, setEligibleUsers] = useState<{ id: string; nome: string; email: string; role: string; setor_id: number | null; setor_codigo: string | null }[]>([])
  const [masterIds, setMasterIds] = useState<string[]>([])
  const [showGestorModal, setShowGestorModal] = useState<false | ('gestor' | 'usuario')[]>(false)
  const [indicadores, setIndicadores] = useState<any[]>([])
  const [riscos, setRiscos] = useState<any[]>([])

  const savingRef = useRef(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalShowCheckbox, setModalShowCheckbox] = useState(false)

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

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)

    const sessionRes = await fetch('/api/auth/session')
    if (!sessionRes.ok) { router.push('/login'); setLoading(false); return }
    const session = await sessionRes.json()
    if (!session.user) { router.push('/login'); setLoading(false); return }

    // Dados via PostgreSQL Docker
    const res = await fetch(`/api/dados/projeto/${id}`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()

    if (data.profile) setProfile(data.profile as Profile)
    if (data.configuracoes) setConfigs(data.configuracoes)
    if (data.setores) setSetores(data.setores)
    if (data.usuarios) setEligibleUsers(data.usuarios.map((u: any) => ({
      id: u.id, nome: u.nome, email: u.email || '', role: u.role || '',
      setor_id: u.setor_id, setor_codigo: u.setor_codigo || null,
    })))
    if (data.acoes) setAcoes(data.acoes)
    if (data.master_ids) setMasterIds(data.master_ids)
    if (data.indicadores) setIndicadores(data.indicadores)
    if (data.riscos) setRiscos(data.riscos)
    if (data.solicitacoes) setSolicitacoes(data.solicitacoes)

    if (data.projeto) {
      const proj = data.projeto
      // Ordenar atividades por data
      proj.entregas?.forEach((e: any) => e.atividades?.sort((a: any, b: any) => {
        if (!a.data_prevista && !b.data_prevista) return a.id - b.id
        if (!a.data_prevista) return 1
        if (!b.data_prevista) return -1
        return a.data_prevista.localeCompare(b.data_prevista)
      }))
      proj.entregas?.sort((a: any, b: any) => {
        const aFirst = a.atividades?.find((at: any) => at.data_prevista)?.data_prevista
        const bFirst = b.atividades?.find((at: any) => at.data_prevista)?.data_prevista
        if (!aFirst && !bFirst) return a.id - b.id
        if (!aFirst) return 1
        if (!bFirst) return -1
        return aFirst.localeCompare(bFirst)
      })
      setProjeto(proj)
      const exp: Record<number, boolean> = {}
      proj.entregas?.forEach((e: any) => { exp[e.id] = false })
      setExpanded(exp)
    }
    setLoading(false)
  }

  // Permission checks — granulares por tipo de entidade (5 níveis)
  const isAdminOrMaster = profile?.role === 'admin' || profile?.role === 'master'
  const isGestor = profile?.role === 'gestor'
  const isSetorLider = isGestor && profile?.setor_id === projeto?.setor_lider_id

  const setoresDisponiveis = useMemo(() => isAdminOrMaster ? setores : setores.filter(s => s.id === profile?.setor_id), [setores, isAdminOrMaster, profile])
  const usuariosDisponiveis = useMemo(() => isAdminOrMaster ? eligibleUsers : eligibleUsers.filter(u => u.setor_id === profile?.setor_id), [eligibleUsers, isAdminOrMaster, profile])

  // Level 1+2: Project and entregas (setor líder)
  const canCreateProjeto = isAdminOrMaster || (isSetorLider && configs['proj_permitir_cadastro'] !== 'false')
  const canEditProjeto = isAdminOrMaster || (isSetorLider && configs['proj_permitir_edicao'] !== 'false')

  // Per-entrega permissions (Levels 2-4)
  function getEntregaPerms(entrega: any) {
    const isRespEntrega = isGestor && profile?.id === entrega?.responsavel_entrega_id
    return {
      canFull: isAdminOrMaster || (isSetorLider && configs['proj_permitir_edicao'] !== 'false'),
      canEditLimited: !isSetorLider && isRespEntrega && configs['proj_permitir_edicao'] !== 'false',
      canEditDatas: isAdminOrMaster || ((isSetorLider || isRespEntrega) && configs['proj_permitir_edicao_datas'] !== 'false'),
      canCrudAtividades: isAdminOrMaster || (isRespEntrega && !!entrega?.responsavel_entrega_id && configs['proj_permitir_edicao_atividades'] !== 'false'),
      canCreateAtividades: isAdminOrMaster || (isRespEntrega && !!entrega?.responsavel_entrega_id && configs['proj_permitir_cadastro_atividades'] !== 'false'),
      canEditDatasAtividades: isAdminOrMaster || ((isRespEntrega) && configs['proj_permitir_edicao_datas_atividades'] !== 'false'),
      needsApproval: !isAdminOrMaster && (isSetorLider || isRespEntrega) && configs['proj_exigir_aprovacao_edicao'] === 'true',
    }
  }

  // Per-atividade permissions (Levels 3-5)
  function getAtividadePerms(atividade: any, entregaPerms: ReturnType<typeof getEntregaPerms>) {
    const isRespAtividade = isGestor && profile?.id === atividade?.responsavel_atividade_id
    return {
      canFull: entregaPerms.canCrudAtividades,
      canEditLimited: !entregaPerms.canCrudAtividades && isRespAtividade && configs['proj_permitir_edicao_atividades'] !== 'false',
      canEditDatas: entregaPerms.canEditDatasAtividades || (isRespAtividade && configs['proj_permitir_edicao_datas_atividades'] !== 'false'),
    }
  }

  // Helper: adicionar alertas para todos os masters (quando não é fluxo de aprovação)
  function appendMasterAlerts(alertas: any[], alertaBase: { tipo: string; entidade: string; entidade_id: number; entidade_nome: string; projeto_id: number; projeto_nome: string; descricao: string }) {
    if (configs['proj_exigir_aprovacao_edicao'] === 'true') return // Se aprovação está ativa, masters já veem via solicitações
    const existingIds = new Set(alertas.map((a: any) => a.destinatario_id))
    for (const mId of masterIds) {
      if (mId !== profile?.id && !existingIds.has(mId)) {
        alertas.push({
          destinatario_id: mId,
          ...alertaBase,
          autor_id: profile!.id, autor_nome: profile!.nome,
        })
      }
    }
  }

  // Pontualidade
  const pontualidade = useMemo(() => {
    if (!projeto?.entregas) return 'em_dia'
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const quinzena = new Date(now); quinzena.setDate(quinzena.getDate() + 15)
    const active = projeto.entregas.filter((e: any) => e.status !== 'resolvida' && e.status !== 'cancelada' && e.data_final_prevista)
    if (active.some((e: any) => new Date(e.data_final_prevista) < now)) return 'atrasado'
    if (active.some((e: any) => { const d = new Date(e.data_final_prevista); return d >= now && d <= quinzena })) return 'proximo'
    return 'em_dia'
  }, [projeto])

  // Status do projeto (calculado a partir das entregas)
  const statusProjeto = useMemo(() => {
    if (projeto?.status === 'hibernando') return 'hibernando'
    const entregas = projeto?.entregas || []
    if (entregas.length === 0) return 'em_andamento'
    if (entregas.every((e: any) => e.status === 'cancelada')) return 'cancelado'
    if (entregas.every((e: any) => e.status === 'resolvida' || e.status === 'cancelada') && entregas.some((e: any) => e.status === 'resolvida')) return 'concluido'
    return 'em_andamento'
  }, [projeto])

  async function toggleHibernando() {
    const newStatus = projeto.status === 'hibernando' ? 'ativo' : 'hibernando'
    const res = await fetch(`/api/dados/projeto/${projeto.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_hibernando', status: newStatus }),
    })
    if (!res.ok) { const e = await res.json(); alert(e.error); return }
    loadAll()
  }

  // needsApproval for project-level operations (setor líder)
  const needsApprovalProjeto = !isAdminOrMaster && isSetorLider && configs['proj_exigir_aprovacao_edicao'] === 'true'

  function hasPendingSolicitacao(tipoEntidade: string, entidadeId: number) {
    return solicitacoes.some(s => s.tipo_entidade === tipoEntidade && s.entidade_id === entidadeId && s.status === 'em_analise')
  }

  async function criarSolicitacao(tipoEntidade: string, entidadeId: number, entidadeNome: string, tipoOperacao: string, dadosAlteracao: any) {
    const res = await fetch(`/api/dados/projeto/${projeto.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_solicitacao',
        tipo_entidade: tipoEntidade,
        entidade_id: entidadeId,
        entidade_nome: entidadeNome,
        tipo_operacao: tipoOperacao,
        dados_alteracao: dadosAlteracao,
      }),
    })
    if (!res.ok) { const e = await res.json(); alert(`Erro ao criar solicitação: ${e.error}`); return false }
    alert('Solicitação enviada para o Gabinete de Gestão de Projetos para avaliação.')
    return true
  }

  async function cancelarSolicitacao(solId: number) {
    if (!confirm('Cancelar esta solicitação?')) return
    const res = await fetch(`/api/dados/projeto/${projeto.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel_solicitacao', solicitacao_id: solId }),
    })
    if (!res.ok) { const e = await res.json(); alert(e.error); return }
    loadAll()
  }

  async function auditLog(tipo: string, entidade: string, entidadeId: number, anterior: any, novo: any) {
    // Audit log gerenciado pelo servidor — mantido por compatibilidade
  }

  // Project edit
  const TIPOS_ACAO = [
    'Prevenção', 'Mitigação', 'Preparação', 'Resposta', 'Recuperação',
    'Gestão/Governança', 'Inovação', 'Integração'
  ]

  // Guard helpers — impedir edição simultânea
  function isAnyEditing() {
    return editingProjeto || editingEntrega !== null || editingAtividade !== null || showNewEntregaForm
  }
  function getEditingLabel() {
    if (editingProjeto) return 'o projeto'
    if (editingEntrega !== null) return 'uma entrega'
    if (editingAtividade !== null) return 'uma atividade'
    if (showNewEntregaForm) return 'uma nova entrega'
    return ''
  }

  function startEditProjeto() {
    // Cancelar qualquer edição ativa automaticamente
    if (editingEntrega !== null) setEditingEntrega(null)
    if (editingAtividade !== null) setEditingAtividade(null)
    if (showNewEntregaForm) setShowNewEntregaForm(false)
    setEditForm({
      nome: projeto.nome, descricao: projeto.descricao, problema_resolve: projeto.problema_resolve,
      causas: projeto.causas || '', consequencias_diretas: projeto.consequencias_diretas || '', objetivos: projeto.objetivos || '',
      responsavel_id: projeto.responsavel_id || '',
      data_inicio: projeto.data_inicio || '',
      dependencias_projetos: projeto.dependencias_projetos || '',
      tipo_acao: projeto.tipo_acao || [],
      setor_lider_id: projeto.setor_lider_id,
      acoes: projeto.projeto_acoes?.map((pa: any) => pa.acao_estrategica?.id) || [],
      indicadores: indicadores.map(i => ({ ...i })),
      riscos: riscos.map(r => ({ ...r }))
    })
    setEditingProjeto(true)
  }

  async function saveEditProjeto() {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)

    // Validação de campos obrigatórios
    if (!editForm.nome?.trim() || !editForm.descricao?.trim() || !editForm.problema_resolve?.trim() || !editForm.causas?.trim() || !editForm.consequencias_diretas?.trim() || !editForm.objetivos?.trim()) {
      alert('Preencha todos os campos obrigatórios: nome, problema, causas, consequências, objetivo e descrição da solução.')
      savingRef.current = false; setSaving(false); return
    }
    if (!editForm.setor_lider_id) {
      alert('Selecione o setor líder.')
      savingRef.current = false; setSaving(false); return
    }
    if (!editForm.acoes || editForm.acoes.length === 0) {
      alert('Selecione ao menos uma ação estratégica.')
      savingRef.current = false; setSaving(false); return
    }
    if (!editForm.responsavel_id) {
      alert('Selecione o líder do projeto.')
      savingRef.current = false; setSaving(false); return
    }

    // R5: Se data_inicio mudou, validar contra datas de entregas e atividades
    if (editForm.data_inicio && editForm.data_inicio !== projeto.data_inicio) {
      const entregas = projeto.entregas || []
      for (const ent of entregas) {
        if (ent.data_final_prevista && ent.data_final_prevista < editForm.data_inicio) {
          alert(`A data de início não pode ser posterior à quinzena da entrega "${ent.nome}" (${ent.data_final_prevista}).`)
          savingRef.current = false; setSaving(false); return
        }
        for (const ativ of (ent.atividades || [])) {
          if (ativ.data_prevista && ativ.data_prevista < editForm.data_inicio) {
            alert(`A data de início não pode ser posterior à data da atividade "${ativ.nome}" (${ativ.data_prevista}).`)
            savingRef.current = false; setSaving(false); return
          }
        }
      }
    }

    if (needsApprovalProjeto) {
      if (hasPendingSolicitacao('projeto', projeto.id)) {
        alert('Já existe uma solicitação pendente para este projeto. Aguarde a avaliação.')
        savingRef.current = false; setSaving(false); return
      }
      const dados = {
        nome: editForm.nome, descricao: editForm.descricao, problema_resolve: editForm.problema_resolve,
        causas: editForm.causas, consequencias_diretas: editForm.consequencias_diretas, objetivos: editForm.objetivos,
        responsavel_id: editForm.responsavel_id || null,
        data_inicio: editForm.data_inicio || null,
        dependencias_projetos: editForm.dependencias_projetos?.trim() || null,
        tipo_acao: editForm.tipo_acao?.length > 0 ? editForm.tipo_acao : null,
        setor_lider_id: editForm.setor_lider_id,
        acoes: editForm.acoes,
        indicadores: editForm.indicadores,
        riscos: editForm.riscos,
      }
      const ok = await criarSolicitacao('projeto', projeto.id, projeto.nome, 'edicao', dados)
      if (ok) { setEditingProjeto(false); loadAll() }
      savingRef.current = false; setSaving(false); return
    }

    // Validação de indicadores
    const indicadoresComDados = (editForm.indicadores || []).filter((i: any) => i.nome || i.formula || i.fonte_dados || i.periodicidade || i.unidade_medida || i.responsavel || i.meta)
    if (indicadoresComDados.some((i: any) => !i.nome?.trim())) {
      alert('Preencha o campo "Nome" de todos os indicadores.')
      savingRef.current = false; setSaving(false); return
    }
    // Validação de riscos
    const riscosComDados = (editForm.riscos || []).filter((r: any) => r.natureza || r.probabilidade || r.impacto || r.medida_resposta)
    if (riscosComDados.some((r: any) => !r.natureza?.trim())) {
      alert('Preencha o campo "Natureza" de todos os riscos.')
      savingRef.current = false; setSaving(false); return
    }

    // Atualização via PostgreSQL Docker
    const res = await fetch(`/api/dados/projeto/${projeto.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_projeto',
        nome: editForm.nome, descricao: editForm.descricao,
        problema_resolve: editForm.problema_resolve,
        causas: editForm.causas, consequencias_diretas: editForm.consequencias_diretas,
        objetivos: editForm.objetivos,
        responsavel_id: editForm.responsavel_id || null,
        data_inicio: editForm.data_inicio || null,
        dependencias_projetos: editForm.dependencias_projetos?.trim() || null,
        tipo_acao: editForm.tipo_acao?.length > 0 ? editForm.tipo_acao : null,
        setor_lider_id: editForm.setor_lider_id,
        acoes_ids: editForm.acoes,
        indicadores: indicadoresComDados,
        riscos: riscosComDados,
        // Para alertas no servidor
        old_responsavel_id: projeto.responsavel_id,
        old_setor_lider_id: projeto.setor_lider_id,
      }),
    })
    if (!res.ok) { const e = await res.json(); alert(e.error || 'Erro ao salvar.'); savingRef.current = false; setSaving(false); return }

    setEditingProjeto(false); savingRef.current = false; setSaving(false); loadAll()
  }

  async function deleteProject() {
    if (needsApprovalProjeto) {
      if (hasPendingSolicitacao('projeto', projeto.id)) {
        alert('Já existe uma solicitação pendente para este projeto. Aguarde a avaliação.')
        return
      }
      if (!confirm(`Solicitar exclusão do projeto "${projeto.nome}"?\n\nA solicitação será enviada para avaliação.`)) return
      await criarSolicitacao('projeto', projeto.id, projeto.nome, 'exclusao', null)
      loadAll(); return
    }

    if (!confirm(`Excluir o projeto "${projeto.nome}"?\n\nTodas as entregas e atividades serão excluídas permanentemente.`)) return
    const res = await fetch(`/api/dados/projeto/${projeto.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_projeto' }),
    })
    if (!res.ok) { const e = await res.json(); alert(e.error || 'Erro ao excluir.'); return }
    router.push('/dashboard/projetos')
  }

  // Entrega edit
  function startEditEntrega(e: any) {
    // Cancelar qualquer edição ativa automaticamente
    if (editingProjeto) setEditingProjeto(false)
    if (editingAtividade !== null) setEditingAtividade(null)
    if (showNewEntregaForm) setShowNewEntregaForm(false)
    if (editingEntrega !== null && editingEntrega !== e.id) setEditingEntrega(null)
    setEditForm({
      nome: e.nome, descricao: e.descricao, criterios_aceite: e.criterios_aceite || '',
      dependencias_criticas: e.dependencias_criticas || '',
      data_inicio: e.data_inicio || '',
      data_final_prevista: e.data_final_prevista || '', status: e.status, motivo_status: e.motivo_status || '',
      orgao_responsavel_setor_id: e.orgao_responsavel_setor_id || null,
      responsavel_entrega_id: e.responsavel_entrega_id || '',
      participantes: e.entrega_participantes?.map((p: any) => ({
        id: p.id, setor_id: p.setor_id, tipo_participante: p.tipo_participante, papel: p.papel
      })) || [],
      resultado_descricao: e.resultado_descricao || '',
      resultado_arquivo_path: e.resultado_arquivo_path || null,
      resultado_arquivo_nome: e.resultado_arquivo_nome || null,
      resultado_arquivo_tamanho: e.resultado_arquivo_tamanho || null,
    })
    setEditingEntrega(e.id)
  }

  async function saveEditEntrega(entregaId: number) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)

    // Validação de setor para gestores
    if (!isAdminOrMaster) {
      if (editForm.orgao_responsavel_setor_id && editForm.orgao_responsavel_setor_id !== profile?.setor_id) {
        alert('Gestores só podem designar membros do próprio setor. Para designar outros setores ou pessoas, entre em contato com o Gabinete de Projetos.')
        savingRef.current = false; setSaving(false); return
      }
      const partSetores = (editForm.participantes || []).filter((p: any) => p.papel?.trim() && p.tipo_participante === 'setor')
      if (partSetores.some((p: any) => p.setor_id !== profile?.setor_id)) {
        alert('Gestores só podem designar membros do próprio setor. Para designar outros setores ou pessoas, entre em contato com o Gabinete de Projetos.')
        savingRef.current = false; setSaving(false); return
      }
    }

    // Validação de campos obrigatórios
    if (!editForm.nome?.trim() || !editForm.descricao?.trim()) {
      alert('Preencha nome e descrição da entrega.')
      savingRef.current = false; setSaving(false); return
    }
    if (!editForm.criterios_aceite?.trim()) {
      alert('Preencha os critérios de aceite da entrega.')
      savingRef.current = false; setSaving(false); return
    }
    if (!editForm.orgao_responsavel_setor_id) {
      alert('Selecione o órgão responsável pela entrega.')
      savingRef.current = false; setSaving(false); return
    }
    if (!editForm.responsavel_entrega_id) {
      alert('Selecione o responsável pela entrega.')
      savingRef.current = false; setSaving(false); return
    }
    if (editForm.responsavel_entrega_id && editForm.orgao_responsavel_setor_id) {
      const respUser = eligibleUsers.find(u => u.id === editForm.responsavel_entrega_id)
      if (respUser && respUser.setor_id !== editForm.orgao_responsavel_setor_id) {
        alert('O responsável pela entrega não pertence ao órgão responsável selecionado.')
        savingRef.current = false; setSaving(false); return
      }
    }

    // Validate: participantes com papel preenchido
    const allParts = editForm.participantes || []
    for (const p of allParts) {
      if ((p.setor_id || p.tipo_participante !== 'setor') && !p.papel?.trim()) {
        alert('Preencha o papel de todos os participantes.')
        savingRef.current = false; setSaving(false); return
      }
    }
    const validP = allParts.filter((p: any) => p.papel?.trim() && (p.setor_id || p.tipo_participante !== 'setor'))
    const pKeys = validP.map((p: any) => p.tipo_participante === 'setor' ? `s_${p.setor_id}` : p.tipo_participante)
    if (new Set(pKeys).size !== pKeys.length) {
      alert('Há participantes duplicados nesta entrega. Use o campo "papel" para múltiplos papéis do mesmo setor.')
      savingRef.current = false; setSaving(false); return
    }

    // R5: Validate quinzena against projeto.data_inicio
    if (editForm.data_final_prevista && projeto.data_inicio && editForm.data_final_prevista < projeto.data_inicio) {
      alert(`A quinzena da entrega não pode ser anterior à data de início do projeto (${formatDateBR(projeto.data_inicio)}).`)
      savingRef.current = false; setSaving(false); return
    }
    if (editForm.data_inicio && projeto.data_inicio && editForm.data_inicio < projeto.data_inicio) {
      alert(`A data de início da entrega não pode ser anterior à data de início do projeto (${formatDateBR(projeto.data_inicio)}).`)
      savingRef.current = false; setSaving(false); return
    }

    // Validate: if quinzena changed, check atividades dates
    const entrega = projeto.entregas.find((e: any) => e.id === entregaId)
    if (editForm.data_final_prevista && entrega?.atividades) {
      const ativPosterior = entrega.atividades.filter((a: any) => a.data_prevista && a.data_prevista > editForm.data_final_prevista)
      if (ativPosterior.length > 0) {
        const nomes = ativPosterior.map((a: any) => `"${a.nome}"`).join(', ')
        alert(`Não é possível definir esta quinzena. As atividades ${nomes} têm datas posteriores. Ajuste-as primeiro.`)
        savingRef.current = false; setSaving(false); return
      }
    }

    // Validate: if data_inicio changed, check atividades dates
    if (editForm.data_inicio && entrega?.atividades) {
      const ativAnterior = entrega.atividades.filter((a: any) => a.data_prevista && a.data_prevista < editForm.data_inicio)
      if (ativAnterior.length > 0) {
        const nomes = ativAnterior.map((a: any) => `"${a.nome}"`).join(', ')
        alert(`Não é possível definir esta data de início. As atividades ${nomes} têm datas anteriores. Ajuste-as primeiro.`)
        savingRef.current = false; setSaving(false); return
      }
    }

    // Validate: if participante removed, check atividades don't reference them
    if (entrega?.atividades) {
      const newSetorIds = new Set(validP.filter((p: any) => p.tipo_participante === 'setor' && p.setor_id).map((p: any) => p.setor_id))
      for (const ativ of entrega.atividades) {
        for (const ap of (ativ.atividade_participantes || [])) {
          if (ap.tipo_participante === 'usuario' && ap.setor_id) {
            if (!newSetorIds.has(ap.setor_id)) {
              const label = ap.user?.nome || 'Usuário'
              alert(`Não é possível remover o setor desta entrega. O participante "${label}" da atividade "${ativ.nome}" pertence a este setor. Remova-o da atividade primeiro.`)
              savingRef.current = false; setSaving(false); return
            }
          } else if (ap.tipo_participante === 'setor') {
            if (!newSetorIds.has(ap.setor_id)) {
              const label = ap.setor?.codigo || 'Setor'
              alert(`Não é possível remover "${label}" desta entrega. Está incluído na atividade "${ativ.nome}". Remova-o da atividade primeiro.`)
              savingRef.current = false; setSaving(false); return
            }
          }
        }
      }
    }

    // Regra 2.2: Não permitir status 'resolvida' se há atividades pendentes
    if (editForm.status === 'resolvida' && entrega?.atividades?.length > 0) {
      const pendentes = entrega.atividades.filter((a: any) =>
        a.status === 'aberta' || a.status === 'em_andamento' || a.status === 'aguardando'
      )
      if (pendentes.length > 0) {
        const nomes = pendentes.map((a: any) => `"${a.nome}"`).join(', ')
        alert(`Não é possível marcar esta entrega como resolvida. As seguintes atividades ainda não foram concluídas: ${nomes}. Resolva ou cancele essas atividades antes.`)
        savingRef.current = false; setSaving(false); return
      }
    }

    const ePerms = getEntregaPerms(entrega)

    if (ePerms.needsApproval) {
      if (hasPendingSolicitacao('entrega', entregaId)) {
        alert('Já existe uma solicitação pendente para esta entrega. Aguarde a avaliação.')
        savingRef.current = false; setSaving(false); return
      }
      const dados = {
        nome: editForm.nome, descricao: editForm.descricao,
        criterios_aceite: editForm.criterios_aceite?.trim() || null,
        dependencias_criticas: editForm.dependencias_criticas || null,
        data_inicio: editForm.data_inicio || null,
        data_final_prevista: editForm.data_final_prevista || null,
        status: editForm.status, motivo_status: editForm.motivo_status || null,
        orgao_responsavel_setor_id: editForm.orgao_responsavel_setor_id || null,
        responsavel_entrega_id: editForm.responsavel_entrega_id || null,
        participantes: validP.map((p: any) => ({
          setor_id: p.tipo_participante === 'setor' ? p.setor_id : null,
          tipo_participante: p.tipo_participante, papel: p.papel.trim()
        })),
      }
      const ok = await criarSolicitacao('entrega', entregaId, entrega?.nome || '', 'edicao', dados)
      if (ok) { setEditingEntrega(null); loadAll() }
      savingRef.current = false; setSaving(false); return
    }

    const res = await fetch(`/api/dados/projeto/${projeto.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_entrega',
        id: entregaId,
        nome: editForm.nome, descricao: editForm.descricao,
        criterios_aceite: editForm.criterios_aceite?.trim() || null,
        dependencias_criticas: editForm.dependencias_criticas || null,
        data_inicio: editForm.data_inicio || null,
        data_final_prevista: editForm.data_final_prevista || null,
        status: editForm.status, motivo_status: editForm.motivo_status || null,
        orgao_responsavel_setor_id: editForm.orgao_responsavel_setor_id || null,
        responsavel_entrega_id: editForm.responsavel_entrega_id || null,
        participantes: validP.map((p: any) => ({
          setor_id: p.tipo_participante === 'setor' ? p.setor_id : null,
          tipo_participante: p.tipo_participante, papel: p.papel.trim()
        })),
        resultado_descricao: editForm.resultado_descricao?.trim() || null,
        resultado_arquivo_path: editForm.resultado_arquivo_path || null,
        resultado_arquivo_nome: editForm.resultado_arquivo_nome || null,
        resultado_arquivo_tamanho: editForm.resultado_arquivo_tamanho || null,
      }),
    })
    if (!res.ok) { const e = await res.json(); alert(e.error || 'Erro ao salvar.'); savingRef.current = false; setSaving(false); return }

    setEditingEntrega(null); savingRef.current = false; setSaving(false); loadAll()
  }

  async function deleteEntrega(e: any) {
    const ePerms = getEntregaPerms(e)
    if (ePerms.needsApproval) {
      if (hasPendingSolicitacao('entrega', e.id)) {
        alert('Já existe uma solicitação pendente para esta entrega. Aguarde a avaliação.')
        return
      }
      if (!confirm(`Solicitar exclusão da entrega "${e.nome}"?\n\nA solicitação será enviada para avaliação.`)) return
      await criarSolicitacao('entrega', e.id, e.nome, 'exclusao', null)
      loadAll(); return
    }

    // Check for pending solicitacoes on child atividades
    const childAtividadeIds = new Set((e.atividades || []).map((a: any) => a.id).filter(Boolean))
    if (childAtividadeIds.size > 0) {
      const pendingSols = solicitacoes.filter(s => childAtividadeIds.has(s.entidade_id) && s.status === 'em_analise')
      if (pendingSols.length > 0) {
        if (!confirm(`Há ${pendingSols.length} solicitação(ões) de alteração pendentes que serão canceladas. Continua?`)) return
      }
    }

    if (!confirm(`Excluir a entrega "${e.nome}"?\n\nTodas as atividades desta entrega serão excluídas.`)) return

    const res = await fetch(`/api/dados/projeto/${projeto.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_entrega', id: e.id }),
    })
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Erro ao excluir.'); return }

    loadAll()
  }

  function addNewEntrega() {
    // Cancelar qualquer edição ativa automaticamente
    if (editingProjeto) setEditingProjeto(false)
    if (editingEntrega !== null) setEditingEntrega(null)
    if (editingAtividade !== null) setEditingAtividade(null)
    setNewEntregaForm({
      nome: '', descricao: '', criterios_aceite: '', dependencias_criticas: '',
      data_inicio: '',
      data_final_prevista: '', status: 'aberta', motivo_status: '',
      orgao_responsavel_setor_id: null, responsavel_entrega_id: '',
      participantes: []
    })
    setShowNewEntregaForm(true)
  }

  async function saveNewEntrega() {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)

    // Validação de setor para gestores
    if (!isAdminOrMaster) {
      if (newEntregaForm.orgao_responsavel_setor_id && newEntregaForm.orgao_responsavel_setor_id !== profile?.setor_id) {
        alert('Gestores só podem designar membros do próprio setor. Para designar outros setores ou pessoas, entre em contato com o Gabinete de Projetos.')
        savingRef.current = false; setSaving(false); return
      }
      const partSetores = (newEntregaForm.participantes || []).filter((p: any) => p.papel?.trim() && p.tipo_participante === 'setor')
      if (partSetores.some((p: any) => p.setor_id !== profile?.setor_id)) {
        alert('Gestores só podem designar membros do próprio setor. Para designar outros setores ou pessoas, entre em contato com o Gabinete de Projetos.')
        savingRef.current = false; setSaving(false); return
      }
    }

    if (!newEntregaForm.nome?.trim()) { alert('Preencha o nome da entrega.'); savingRef.current = false; setSaving(false); return }
    if (!newEntregaForm.descricao?.trim()) { alert('Preencha a descrição da entrega.'); savingRef.current = false; setSaving(false); return }
    if (!newEntregaForm.criterios_aceite?.trim()) { alert('Preencha os critérios de aceite da entrega.'); savingRef.current = false; setSaving(false); return }
    if (!newEntregaForm.orgao_responsavel_setor_id) { alert('Selecione o órgão responsável pela entrega.'); savingRef.current = false; setSaving(false); return }
    if (!newEntregaForm.responsavel_entrega_id) { alert('Selecione o responsável pela entrega.'); savingRef.current = false; setSaving(false); return }

    // Validate participantes
    const allParts = newEntregaForm.participantes || []
    for (const p of allParts) {
      if ((p.setor_id || p.tipo_participante !== 'setor') && !p.papel?.trim()) {
        alert('Preencha o papel de todos os participantes.'); savingRef.current = false; setSaving(false); return
      }
    }
    const validP = allParts.filter((p: any) => p.papel?.trim() && (p.setor_id || p.tipo_participante !== 'setor'))
    const pKeys = validP.map((p: any) => p.tipo_participante === 'setor' ? `s_${p.setor_id}` : p.tipo_participante)
    if (new Set(pKeys).size !== pKeys.length) {
      alert('Há participantes duplicados nesta entrega.'); savingRef.current = false; setSaving(false); return
    }

    // R5: Validate quinzena against projeto.data_inicio
    if (newEntregaForm.data_final_prevista && projeto.data_inicio && newEntregaForm.data_final_prevista < projeto.data_inicio) {
      alert(`A quinzena da entrega não pode ser anterior à data de início do projeto (${formatDateBR(projeto.data_inicio)}).`)
      savingRef.current = false; setSaving(false); return
    }
    if (newEntregaForm.data_inicio && projeto.data_inicio && newEntregaForm.data_inicio < projeto.data_inicio) {
      alert(`A data de início da entrega não pode ser anterior à data de início do projeto (${formatDateBR(projeto.data_inicio)}).`)
      savingRef.current = false; setSaving(false); return
    }

    const res = await fetch(`/api/dados/projeto/${projeto.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_entrega',
        nome: newEntregaForm.nome.trim(),
        descricao: newEntregaForm.descricao?.trim() || '',
        criterios_aceite: newEntregaForm.criterios_aceite?.trim() || null,
        dependencias_criticas: newEntregaForm.dependencias_criticas?.trim() || null,
        data_inicio: newEntregaForm.data_inicio || null,
        data_final_prevista: newEntregaForm.data_final_prevista || null,
        status: newEntregaForm.status,
        motivo_status: newEntregaForm.motivo_status?.trim() || null,
        orgao_responsavel_setor_id: newEntregaForm.orgao_responsavel_setor_id || null,
        responsavel_entrega_id: newEntregaForm.responsavel_entrega_id || null,
        participantes: validP.map((p: any) => ({
          setor_id: p.tipo_participante === 'setor' ? p.setor_id : null,
          tipo_participante: p.tipo_participante, papel: p.papel.trim()
        })),
      }),
    })
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Erro ao criar entrega.'); savingRef.current = false; setSaving(false); return }

    setShowNewEntregaForm(false)
    savingRef.current = false; setSaving(false)
    loadAll()
  }

  // Atividade edit
  function startEditAtividade(a: any, entrega: any) {
    // Cancelar qualquer edição ativa automaticamente
    if (editingProjeto) setEditingProjeto(false)
    if (editingEntrega !== null) setEditingEntrega(null)
    if (showNewEntregaForm) setShowNewEntregaForm(false)
    if (editingAtividade !== null && editingAtividade !== a.id) setEditingAtividade(null)
    setEditForm({
      nome: a.nome, descricao: a.descricao, data_prevista: a.data_prevista || '',
      status: a.status || 'aberta', motivo_status: a.motivo_status || '',
      responsavel_atividade_id: a.responsavel_atividade_id || '',
      entrega_data_final: entrega.data_final_prevista || '',
      entrega_data_inicio: entrega.data_inicio || '',
      entrega_participantes: entrega.entrega_participantes || [],
      participantes: a.atividade_participantes?.map((p: any) => ({
        id: p.id, user_id: p.user_id || null, setor_id: p.setor_id, tipo_participante: p.tipo_participante, papel: p.papel
      })) || [],
      resultado_descricao: a.resultado_descricao || '',
      resultado_arquivo_path: a.resultado_arquivo_path || null,
      resultado_arquivo_nome: a.resultado_arquivo_nome || null,
      resultado_arquivo_tamanho: a.resultado_arquivo_tamanho || null,
    })
    setEditingAtividade(a.id)
  }

  async function saveEditAtividade(ativId: number, entregaId: number) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    const isNew = editForm._isNew

    // Validação de setor para gestores
    if (!isAdminOrMaster) {
      if (editForm.responsavel_atividade_id) {
        const resp = eligibleUsers.find(u => u.id === editForm.responsavel_atividade_id)
        if (resp && resp.setor_id !== profile?.setor_id) {
          alert('Gestores só podem designar membros do próprio setor. Para designar outros setores ou pessoas, entre em contato com o Gabinete de Projetos.')
          savingRef.current = false; setSaving(false); return
        }
      }
    }

    // Validações básicas
    if (!editForm.nome?.trim()) { alert('Preencha o nome da atividade.'); savingRef.current = false; setSaving(false); return }
    if (!editForm.descricao?.trim()) { alert('Preencha a descrição da atividade.'); savingRef.current = false; setSaving(false); return }
    if (!editForm.responsavel_atividade_id) { alert('Selecione o responsável pela atividade.'); savingRef.current = false; setSaving(false); return }

    // Validate date <= entrega quinzena
    if (editForm.data_prevista && editForm.entrega_data_final && editForm.data_prevista > editForm.entrega_data_final) {
      alert(`A data da atividade não pode ser posterior à quinzena da entrega (${editForm.entrega_data_final}).`)
      savingRef.current = false; setSaving(false); return
    }

    // Validate data_prevista >= entrega.data_inicio
    if (editForm.data_prevista && editForm.entrega_data_inicio && editForm.data_prevista < editForm.entrega_data_inicio) {
      alert(`A data da atividade não pode ser anterior à data de início da entrega (${formatDateBR(editForm.entrega_data_inicio)}).`)
      savingRef.current = false; setSaving(false); return
    }

    // R5: Validate data_prevista against projeto.data_inicio
    if (editForm.data_prevista && projeto.data_inicio && editForm.data_prevista < projeto.data_inicio) {
      alert(`A data da atividade não pode ser anterior à data de início do projeto (${formatDateBR(projeto.data_inicio)}).`)
      savingRef.current = false; setSaving(false); return
    }

    // Validate: participantes com papel preenchido
    const allP = editForm.participantes || []
    for (const p of allP) {
      if ((p.user_id || p.setor_id || p.tipo_participante !== 'setor') && !p.papel?.trim()) {
        alert('Preencha o papel de todos os participantes.')
        savingRef.current = false; setSaving(false); return
      }
    }
    const validP = allP.filter((p: any) => p.papel?.trim() && (p.user_id || p.setor_id || p.tipo_participante !== 'setor'))

    // Validate: user's setor must be in entrega participantes
    const entregaSetorIds = new Set((editForm.entrega_participantes || []).filter((ep: any) => ep.tipo_participante === 'setor' && ep.setor_id).map((ep: any) => ep.setor_id))
    for (const ap of validP) {
      if (ap.tipo_participante === 'usuario' && ap.user_id) {
        const u = eligibleUsers.find((u: any) => u.id === ap.user_id)
        if (u?.setor_id && !entregaSetorIds.has(u.setor_id)) {
          alert(`O participante "${u.nome}" pertence a um setor que não está na entrega. Remova-o ou adicione o setor à entrega primeiro.`)
          savingRef.current = false; setSaving(false); return
        }
      }
    }

    // Validate: no duplicates
    const pKeys = validP.map((p: any) => p.tipo_participante === 'usuario' ? `u_${p.user_id}` : (p.tipo_participante === 'setor' ? `s_${p.setor_id}` : p.tipo_participante))
    if (new Set(pKeys).size !== pKeys.length) {
      alert('Há participantes duplicados nesta atividade.')
      savingRef.current = false; setSaving(false); return
    }

    const entregaForAtiv = projeto.entregas?.find((en: any) => en.id === entregaId)
    const ePermsAtiv = getEntregaPerms(entregaForAtiv)

    if (ePermsAtiv.needsApproval && !isNew) {
      if (hasPendingSolicitacao('atividade', ativId)) {
        alert('Já existe uma solicitação pendente para esta atividade. Aguarde a avaliação.')
        savingRef.current = false; setSaving(false); return
      }
      const ativ = projeto.entregas?.flatMap((e: any) => e.atividades || []).find((a: any) => a.id === ativId)
      const dados = {
        nome: editForm.nome, descricao: editForm.descricao,
        data_prevista: editForm.data_prevista || null,
        status: editForm.status, motivo_status: editForm.motivo_status || null,
        responsavel_atividade_id: editForm.responsavel_atividade_id || null,
        participantes: validP.map((p: any) => ({
          user_id: p.tipo_participante === 'usuario' ? p.user_id : null,
          setor_id: p.setor_id,
          tipo_participante: p.tipo_participante, papel: p.papel.trim()
        })),
      }
      const ok = await criarSolicitacao('atividade', ativId, ativ?.nome || editForm.nome, 'edicao', dados)
      if (ok) { setEditingAtividade(null); loadAll() }
      savingRef.current = false; setSaving(false); return
    }

    const ativAtualForResultado = projeto.entregas?.flatMap((e: any) => e.atividades || []).find((a: any) => a.id === ativId)
    const novosDadosA = {
      nome: editForm.nome.trim(), descricao: editForm.descricao.trim(),
      data_prevista: editForm.data_prevista || null,
      status: editForm.status, motivo_status: editForm.motivo_status || null,
      responsavel_atividade_id: editForm.responsavel_atividade_id || null,
      resultado_descricao: editForm.resultado_descricao?.trim() || null,
      resultado_arquivo_path: editForm.resultado_arquivo_path || null,
      resultado_arquivo_nome: editForm.resultado_arquivo_nome || null,
      resultado_arquivo_tamanho: editForm.resultado_arquivo_tamanho || null,
      resultado_arquivo_enviado_em:
        (editForm.resultado_arquivo_path || null) !== (ativAtualForResultado?.resultado_arquivo_path || null)
          ? (editForm.resultado_arquivo_path ? new Date().toISOString() : null)
          : (ativAtualForResultado?.resultado_arquivo_enviado_em || null),
    }

    const res = await fetch(`/api/dados/projeto/${projeto.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: isNew ? 'create_atividade' : 'update_atividade',
        id: isNew ? undefined : ativId,
        entrega_id: entregaId,
        nome: editForm.nome.trim(), descricao: editForm.descricao.trim(),
        data_prevista: editForm.data_prevista || null,
        status: editForm.status, motivo_status: editForm.motivo_status || null,
        responsavel_atividade_id: editForm.responsavel_atividade_id || null,
        resultado_descricao: editForm.resultado_descricao?.trim() || null,
        resultado_arquivo_path: editForm.resultado_arquivo_path || null,
        resultado_arquivo_nome: editForm.resultado_arquivo_nome || null,
        resultado_arquivo_tamanho: editForm.resultado_arquivo_tamanho || null,
        participantes: validP.map((p: any) => ({
          user_id: p.tipo_participante === 'usuario' ? p.user_id : null,
          setor_id: p.setor_id,
          tipo_participante: p.tipo_participante, papel: p.papel.trim()
        }))
      }),
    })
    if (!res.ok) { const e = await res.json(); alert(e.error || 'Erro ao salvar atividade.'); savingRef.current = false; setSaving(false); return }

    setEditingAtividade(null); savingRef.current = false; setSaving(false); loadAll()
  }

  async function deleteAtividade(a: any, entregaParent?: any) {
    const entregaDel = entregaParent || projeto.entregas?.find((en: any) => en.atividades?.some((at: any) => at.id === a.id))
    const ePermsDel = getEntregaPerms(entregaDel)
    if (ePermsDel.needsApproval) {
      if (hasPendingSolicitacao('atividade', a.id)) {
        alert('Já existe uma solicitação pendente para esta atividade. Aguarde a avaliação.')
        return
      }
      if (!confirm(`Solicitar exclusão da atividade "${a.nome}"?\n\nA solicitação será enviada para avaliação.`)) return
      await criarSolicitacao('atividade', a.id, a.nome, 'exclusao', null)
      loadAll(); return
    }

    if (!confirm(`Excluir a atividade "${a.nome}"?`)) return
    
    const res = await fetch(`/api/dados/projeto/${projeto.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_atividade', id: a.id }),
    })
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Erro ao excluir.'); return }
    
    loadAll()
  }

  function addNewAtividade(entregaId: number) {
    // Cancelar qualquer edição ativa automaticamente
    if (editingProjeto) setEditingProjeto(false)
    if (editingEntrega !== null) setEditingEntrega(null)
    if (showNewEntregaForm) setShowNewEntregaForm(false)
    if (editingAtividade !== null) setEditingAtividade(null)
    const entrega = projeto.entregas.find((e: any) => e.id === entregaId)
    setEditForm({
      nome: '', descricao: '', data_prevista: '',
      status: 'aberta', motivo_status: '',
      responsavel_atividade_id: '',
      entrega_data_final: entrega?.data_final_prevista || '',
      entrega_data_inicio: entrega?.data_inicio || '',
      entrega_participantes: entrega?.entrega_participantes || [],
      participantes: [],
      _isNew: true, _entregaId: entregaId
    })
    setEditingAtividade(-entregaId) // Negativo para indicar nova atividade
  }

  function toggleExpandAll() {
    const newVal = !allExpanded
    setAllExpanded(newVal)
    const exp: Record<number, boolean> = {}
    projeto.entregas?.forEach((e: any) => { exp[e.id] = newVal })
    setExpanded(exp)
  }

  function formatQuinzena(dateStr: string | null) {
    if (!dateStr) return '—'
    const d = new Date(dateStr + 'T00:00:00')
    const month = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    const year = d.getFullYear().toString().slice(-2)
    const q = d.getDate() <= 15 ? '1ª' : '2ª'
    return `${month}/${year} – ${q} quinz.`
  }

  function participanteLabel(p: any) {
    if (p.tipo_participante === 'usuario') return p.user?.nome || 'Usuário'
    if (p.tipo_participante === 'externo_subsegop') return 'Ator externo à SUBSEGOP'
    if (p.tipo_participante === 'externo_sedec') return 'Ator externo à SEDEC'
    return p.setor?.codigo || 'Setor'
  }

  function pKeyEdit(p: any) {
    if (p.tipo_participante === 'usuario') return `u_${p.user_id}`
    return p.tipo_participante === 'setor' ? `s_${p.setor_id}` : p.tipo_participante
  }

  // Participante edit row for ENTREGA (all setores, no duplicates)
  function renderEntregaParticipanteEditRow(p: any, idx: number, allParts: any[], onChange: (i: number, f: string, v: any) => void, onRemove: (i: number) => void) {
    const usedKeys = new Set(allParts.filter((_: any, i: number) => i !== idx).map(pKeyEdit))
    return (
      <div key={idx} className="flex gap-2 items-start">
        <select value={p.tipo_participante === 'setor' ? (p.setor_id || '') : p.tipo_participante}
          onChange={ev => {
            const v = ev.target.value
            if (v === 'externo_subsegop' || v === 'externo_sedec') { onChange(idx, 'tipo_participante', v); onChange(idx, 'setor_id', null) }
            else { onChange(idx, 'tipo_participante', 'setor'); onChange(idx, 'setor_id', parseInt(v) || null) }
          }} className="input-field text-xs flex-1">
          <option value="">Participante...</option>
          <optgroup label="Setores">
            {setoresDisponiveis.map((s: any) => <option key={s.id} value={s.id} disabled={usedKeys.has(`s_${s.id}`)}>{s.codigo}{usedKeys.has(`s_${s.id}`) ? ' (já)' : ''}</option>)}
          </optgroup>
          <optgroup label="Externos">
            <option value="externo_subsegop" disabled={usedKeys.has('externo_subsegop')}>Ext. SUBSEGOP{usedKeys.has('externo_subsegop') ? ' (já)' : ''}</option>
            <option value="externo_sedec" disabled={usedKeys.has('externo_sedec')}>Ext. SEDEC{usedKeys.has('externo_sedec') ? ' (já)' : ''}</option>
          </optgroup>
        </select>
        <input type="text" value={p.papel || ''} onChange={ev => onChange(idx, 'papel', ev.target.value)}
          placeholder="Papel (múltiplos papéis aqui)" className="input-field text-xs flex-1" />
        <button type="button" onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600 mt-2"><Trash2 size={13} /></button>
      </div>
    )
  }

  // Participante edit row for ATIVIDADE (usuários cujo setor está na entrega)
  function renderAtividadeParticipanteEditRow(p: any, idx: number, allParts: any[], entregaParts: any[], onChange: (i: number, f: string, v: any) => void, onRemove: (i: number) => void) {
    const usedUserIds = new Set(allParts.filter((_: any, i: number) => i !== idx).filter((ap: any) => ap.user_id).map((ap: any) => ap.user_id))
    const entregaSetorIds = new Set(entregaParts.filter((ep: any) => ep.tipo_participante === 'setor' && ep.setor_id).map((ep: any) => ep.setor_id))
    const filteredUsers = (isAdminOrMaster ? eligibleUsers.filter(u => {
      if (usedUserIds.has(u.id)) return false
      if (entregaSetorIds.size === 0) return false
      return u.setor_id ? entregaSetorIds.has(u.setor_id) : false
    }) : eligibleUsers.filter(u => {
      if (usedUserIds.has(u.id)) return false
      return u.setor_id === profile?.setor_id
    }))
    const selectedUser = p.user_id ? eligibleUsers.find(u => u.id === p.user_id) : null
    return (
      <div key={idx} className="flex gap-2 items-start">
        <div className="flex-1 min-w-0">
          <UserAutocompleteSelect
            value={p.user_id || null}
            onChange={userId => {
              const u = userId ? eligibleUsers.find(u => u.id === userId) : null
              onChange(idx, 'user_id', userId)
              onChange(idx, 'setor_id', u?.setor_id || null)
              onChange(idx, 'tipo_participante', 'usuario')
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
        <input type="text" value={p.papel || ''} onChange={ev => onChange(idx, 'papel', ev.target.value)}
          placeholder="Papel na atividade" className="input-field text-xs flex-1" />
        <button type="button" onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-600 mt-2"><Trash2 size={13} /></button>
      </div>
    )
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-pulse text-sedec-500">Carregando...</div></div>
  if (!projeto) return <div className="text-center py-20 text-gray-400">Projeto não encontrado.</div>

  const pontKey = statusProjeto !== 'em_andamento' ? statusProjeto : pontualidade
  const pont = PONT_CONFIG[pontKey]
  const PontIcon = pont.icon

  return (
    <div>
      <ProjectGuidelineModal isOpen={modalOpen} onClose={() => setModalOpen(false)} showCheckbox={modalShowCheckbox} />
      <HelpTooltipModal type={helpType} onClose={() => setHelpType(null)} userRole={profile?.role} />
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push('/dashboard/projetos')}
          className="flex items-center gap-2 text-sm text-sedec-500 hover:text-sedec-700">
          <ArrowLeft size={16} /> Voltar aos projetos
        </button>
        {canCreateProjeto && (
          <button onClick={() => router.push('/dashboard/projetos/novo')}
            className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
            <Plus size={15} /> Novo projeto
          </button>
        )}
      </div>

      {/* Header do projeto */}
      <div className={`bg-white rounded-xl border overflow-hidden mb-6 ${editingProjeto ? 'border-blue-400 ring-2 ring-blue-100 shadow-md' : 'border-gray-200'}`}>
        <div className={`h-1 ${pont.bg === 'bg-green-50' ? 'bg-green-400' : pont.bg === 'bg-yellow-50' ? 'bg-yellow-400' : 'bg-red-400'}`} />
        <div className={`p-6 ${editingProjeto ? 'bg-blue-50/20' : ''}`}>
          {editingProjeto ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Modo de edição</span>
                </div>
                <button type="button" onClick={() => setHelpType('permissoes')} className="flex items-center gap-1.5 text-xs text-sedec-500 hover:text-sedec-700 bg-sedec-50 hover:bg-sedec-100 px-3 py-1.5 rounded-lg transition-colors font-medium border border-sedec-200" title="Regras de permissão">
                  <HelpCircle size={14} /> Regras de permissão
                </button>
              </div>
              <AIAssistantsCard />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nome do projeto</label>
                  <input type="text" value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all font-bold text-gray-800" />
                </div>

                {isAdminOrMaster && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Setor líder</label>
                    <select value={editForm.setor_lider_id} onChange={e => setEditForm({ ...editForm, setor_lider_id: parseInt(e.target.value), responsavel_id: null })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm">
                      {setores.map((s: any) => <option key={s.id} value={s.id}>{s.codigo} — {s.nome_completo}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Líder do projeto *</label>
                    <button type="button" onClick={openHelpModal} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={13} /></button>
                  </div>
                  <UserAutocompleteSelect
                    value={editForm.responsavel_id}
                    onChange={val => setEditForm({ ...editForm, responsavel_id: val })}
                    users={eligibleUsers.filter(u => u.role !== 'usuario' && u.setor_id === editForm.setor_lider_id)}
                    placeholder="Selecione o líder..."
                    required
                    disabled={!canEditProjeto}
                    onRegisterNew={() => setShowGestorModal(['gestor'])}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Data de início</label>
                  <input type="date" value={editForm.data_inicio || ''} onChange={e => setEditForm({ ...editForm, data_inicio: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-gray-700" />
                </div>
              </div>

              <div className="space-y-6 pt-4 border-t border-blue-100/50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Problema Identificado — POR QUE o projeto existe</label>
                    <button type="button" onClick={() => setHelpType('campo_problema')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={13} /></button>
                  </div>
                  <textarea value={editForm.problema_resolve} onChange={e => setEditForm({ ...editForm, problema_resolve: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-gray-700 resize-y leading-relaxed" rows={4}
                    placeholder={'Descreva a situação atual que impacta negativamente os resultados do setor ou o cumprimento da missão institucional. Foque no problema em si — não em suas causas, não em como resolvê-lo. Ex.: "Comunidades em áreas de risco apresentam alta vulnerabilidade a desastres."'} />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Causas do Problema — O QUE origina essa situação</label>
                    <button type="button" onClick={() => setHelpType('campo_causas')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={13} /></button>
                  </div>
                  <textarea value={editForm.causas || ''} onChange={e => setEditForm({ ...editForm, causas: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-gray-700 resize-y leading-relaxed" rows={4}
                    placeholder={'Liste os fatores que geram ou agravam o problema identificado. Separe as causas por ponto e vírgula ou em linhas distintas. Ex.: "Baixa percepção de risco pelos moradores; ausência de cultura de preparação individual; falta de canais acessíveis de informação sobre riscos locais."'} />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Consequências Diretas do Problema — O QUE acontece por causa dele</label>
                    <button type="button" onClick={() => setHelpType('campo_consequencias')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={13} /></button>
                  </div>
                  <textarea value={editForm.consequencias_diretas || ''} onChange={e => setEditForm({ ...editForm, consequencias_diretas: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-gray-700 resize-y leading-relaxed" rows={4}
                    placeholder={'Descreva os impactos imediatos que decorrem diretamente do problema, sem depender de uma cadeia de eventos intermediários. Ex.: "Moradores permanecem em áreas de risco mesmo após emissão de alertas; famílias não adotam medidas básicas de autoproteção."'} />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Objetivo do Projeto — PARA QUE ele existe</label>
                    <button type="button" onClick={() => setHelpType('campo_objetivo')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={13} /></button>
                  </div>
                  <textarea value={editForm.objetivos || ''} onChange={e => setEditForm({ ...editForm, objetivos: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-gray-700 resize-y leading-relaxed" rows={4}
                    placeholder={'Declare a transformação concreta que o projeto pretende alcançar ao atuar sobre as causas identificadas. Ex.: "Aumentar a percepção de risco em comunidades vulneráveis, reduzindo comportamentos que elevam sua exposição a situações de desastre."'} />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Descrição da Solução Proposta — O QUE será feito</label>
                    <button type="button" onClick={() => setHelpType('campo_descricao')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={13} /></button>
                  </div>
                  <textarea value={editForm.descricao} onChange={e => setEditForm({ ...editForm, descricao: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-gray-700 resize-y leading-relaxed" rows={4}
                    placeholder={'Descreva a intervenção institucional que o projeto representa — ou seja, o que será feito para alcançar o objetivo declarado e atuar sobre as causas identificadas. Ex.: "Implantação de programa estruturado de educação comunitária em gestão de riscos, com metodologia replicável e integração com as redes de defesa civil municipal."'} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Indicador(es) de sucesso - Como saberemos que funcionou?</label>
                    </div>
                    <button type="button" onClick={() => setEditForm({ ...editForm, indicadores: [...(editForm.indicadores || []), { nome: '', formula: '', fonte_dados: '', periodicidade: '', unidade_medida: '', responsavel: '', meta: '' }] })}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                      <Plus size={14} /> Indicador
                    </button>
                  </div>
                  {(!editForm.indicadores || editForm.indicadores.length === 0) && (
                    <p className="text-xs text-gray-400 italic">Nenhum indicador adicionado. Clique em &quot;+ Indicador&quot; para adicionar.</p>
                  )}
                  <div className="space-y-3">
                    {(editForm.indicadores || []).map((ind: any, idx: number) => (
                      <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 relative">
                        <button type="button" onClick={() => setEditForm({ ...editForm, indicadores: editForm.indicadores.filter((_: any, i: number) => i !== idx) })}
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
                            <input type="text" value={ind.nome || ''} onChange={e => setEditForm({ ...editForm, indicadores: editForm.indicadores.map((item: any, i: number) => i === idx ? { ...item, nome: e.target.value } : item) })}
                              className="input-field text-sm" placeholder='Ex.: "Percentual de moradores capacitados em autoproteção"' />
                          </div>
                          <div className="md:col-span-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <label className="text-xs text-gray-500">Fórmula de Cálculo</label>
                              <button type="button" onClick={() => setHelpType('campo_ind_formula')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                            </div>
                            <input type="text" value={ind.formula || ''} onChange={e => setEditForm({ ...editForm, indicadores: editForm.indicadores.map((item: any, i: number) => i === idx ? { ...item, formula: e.target.value } : item) })}
                              className="input-field text-sm" placeholder='Ex.: "(Nº capacitados ÷ total da área-alvo) × 100"' />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <label className="text-xs text-gray-500">Fonte de Dados</label>
                              <button type="button" onClick={() => setHelpType('campo_ind_fonte')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                            </div>
                            <input type="text" value={ind.fonte_dados || ''} onChange={e => setEditForm({ ...editForm, indicadores: editForm.indicadores.map((item: any, i: number) => i === idx ? { ...item, fonte_dados: e.target.value } : item) })}
                              className="input-field text-sm" placeholder='Ex.: "Lista de presença", "Sistema SISGEO"' />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <label className="text-xs text-gray-500">Periodicidade/Frequência</label>
                              <button type="button" onClick={() => setHelpType('campo_ind_periodicidade')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                            </div>
                            <input type="text" value={ind.periodicidade || ''} onChange={e => setEditForm({ ...editForm, indicadores: editForm.indicadores.map((item: any, i: number) => i === idx ? { ...item, periodicidade: e.target.value } : item) })}
                              className="input-field text-sm" placeholder='Ex.: "Mensal", "Trimestral", "Ao final de cada entrega"' />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <label className="text-xs text-gray-500">Unidade de Medida</label>
                              <button type="button" onClick={() => setHelpType('campo_ind_unidade')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                            </div>
                            <input type="text" value={ind.unidade_medida || ''} onChange={e => setEditForm({ ...editForm, indicadores: editForm.indicadores.map((item: any, i: number) => i === idx ? { ...item, unidade_medida: e.target.value } : item) })}
                              className="input-field text-sm" placeholder='Ex.: "Percentual (%)", "Número absoluto", "R$"' />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <label className="text-xs text-gray-500">Responsável</label>
                              <button type="button" onClick={() => setHelpType('campo_ind_responsavel')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                            </div>
                            <input type="text" value={ind.responsavel || ''} onChange={e => setEditForm({ ...editForm, indicadores: editForm.indicadores.map((item: any, i: number) => i === idx ? { ...item, responsavel: e.target.value } : item) })}
                              className="input-field text-sm" placeholder='Ex.: "Coordenador de capacitação do setor X"' />
                          </div>
                          <div className="md:col-span-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <label className="text-xs text-gray-500">Meta</label>
                              <button type="button" onClick={() => setHelpType('campo_ind_meta')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                            </div>
                            <input type="text" value={ind.meta || ''} onChange={e => setEditForm({ ...editForm, indicadores: editForm.indicadores.map((item: any, i: number) => i === idx ? { ...item, meta: e.target.value } : item) })}
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
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Matriz de Riscos</label>
                    </div>
                    <button type="button" onClick={() => setEditForm({ ...editForm, riscos: [...(editForm.riscos || []), { natureza: '', probabilidade: '', impacto: '', medida_resposta: '' }] })}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                      <Plus size={14} /> Risco
                    </button>
                  </div>
                  {(!editForm.riscos || editForm.riscos.length === 0) && (
                    <p className="text-xs text-gray-400 italic">Nenhum risco adicionado. Clique em &quot;+ Risco&quot; para adicionar.</p>
                  )}
                  <div className="space-y-3">
                    {(editForm.riscos || []).map((risco: any, idx: number) => (
                      <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 relative">
                        <button type="button" onClick={() => setEditForm({ ...editForm, riscos: editForm.riscos.filter((_: any, i: number) => i !== idx) })}
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
                            <textarea value={risco.natureza || ''} onChange={e => setEditForm({ ...editForm, riscos: editForm.riscos.map((item: any, i: number) => i === idx ? { ...item, natureza: e.target.value } : item) })}
                              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-gray-700 resize-y leading-relaxed" rows={2}
                              placeholder='Ex.: "Indisponibilidade de servidores capacitados para as atividades de campo"' />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <label className="text-xs text-gray-500">Probabilidade</label>
                              <button type="button" onClick={() => setHelpType('campo_risco_probabilidade')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={12} /></button>
                            </div>
                            <select value={risco.probabilidade || ''} onChange={e => setEditForm({ ...editForm, riscos: editForm.riscos.map((item: any, i: number) => i === idx ? { ...item, probabilidade: e.target.value } : item) })}
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
                            <select value={risco.impacto || ''} onChange={e => setEditForm({ ...editForm, riscos: editForm.riscos.map((item: any, i: number) => i === idx ? { ...item, impacto: e.target.value } : item) })}
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
                            <textarea value={risco.medida_resposta || ''} onChange={e => setEditForm({ ...editForm, riscos: editForm.riscos.map((item: any, i: number) => i === idx ? { ...item, medida_resposta: e.target.value } : item) })}
                              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-gray-700 resize-y leading-relaxed" rows={2}
                              placeholder='Ex.: "Identificar e capacitar servidores de outros setores como alternativa; firmar acordo com órgão parceiro"' />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dependências críticas do projeto</label>
                    <button type="button" onClick={() => setHelpType('campo_dependencias')} className="text-gray-400 hover:text-orange-500 transition-colors"><HelpCircle size={13} /></button>
                  </div>
                  <textarea value={editForm.dependencias_projetos || ''} onChange={e => setEditForm({ ...editForm, dependencias_projetos: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-sm text-gray-700 resize-y leading-relaxed" rows={2}
                    placeholder={'Descreva dependências críticas deste projeto: outros projetos, aprovações orçamentárias, decisões normativas, disponibilidade de recursos, fornecedores externos etc. Ex.: "Depende da conclusão do Projeto X para acesso ao sistema Y; aguarda liberação de crédito orçamentário para aquisição de equipamentos"'} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-blue-100/50">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Ações estratégicas vinculadas</label>
                  <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-xl p-2 space-y-1 bg-white">
                    {acoes.map((a: any) => (
                      <label key={a.id} className="flex items-start gap-3 text-sm p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                        <input type="checkbox" checked={editForm.acoes?.includes(a.id)}
                          onChange={() => setEditForm((prev: any) => ({
                            ...prev, acoes: prev.acoes.includes(a.id) ? prev.acoes.filter((x: number) => x !== a.id) : [...prev.acoes, a.id]
                          }))} className="mt-0.5 rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                        <div>
                          <span className="font-bold text-sedec-600 block">AE {a.numero}</span>
                          <span className="text-gray-600 leading-snug">{a.nome}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Tipo de ação</label>
                  <div className="flex flex-wrap gap-2 border border-gray-200 rounded-xl p-4 bg-white">
                    {TIPOS_ACAO.map(tipo => (
                      <label key={tipo} className="flex items-center gap-2 text-sm bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg cursor-pointer hover:border-orange-300 hover:bg-orange-50 transition-all">
                        <input type="checkbox" checked={editForm.tipo_acao?.includes(tipo) || false}
                          onChange={() => setEditForm((prev: any) => ({
                            ...prev, tipo_acao: prev.tipo_acao?.includes(tipo) ? prev.tipo_acao.filter((t: string) => t !== tipo) : [...(prev.tipo_acao || []), tipo]
                          }))} className="rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                        <span className="text-gray-700 font-medium">{tipo}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-blue-100/50">
                <button onClick={saveEditProjeto} disabled={saving}
                  className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"><Save size={16} /> Salvar alterações</button>
                <button onClick={() => setEditingProjeto(false)}
                  className="flex items-center gap-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-5 py-2.5 rounded-lg font-medium transition-colors"><X size={16} /> Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="mb-2 w-full pr-4">
                    {projeto.codigo_sequencial != null && (
                      <span className="inline-block mr-2 px-2 py-0.5 rounded bg-orange-100 text-orange-700 text-xs font-bold align-middle border border-orange-200">
                        SP-{String(projeto.codigo_sequencial).padStart(4, '0')}
                      </span>
                    )}
                    <h1 className="text-xl font-bold text-gray-800 inline leading-tight align-middle">{projeto.nome}</h1>
                    <button type="button" onClick={() => setHelpType('projeto')} className="inline-flex align-middle ml-2 text-gray-400 hover:text-orange-500 transition-colors" title="O que é um Projeto?">
                      <HelpCircle size={18} />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="bg-gray-100 text-gray-600 px-2.5 py-1 rounded font-medium border border-gray-200">
                      {projeto.setor_lider?.codigo} — {projeto.setor_lider?.nome_completo}
                    </span>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${pont.bg} ${pont.color}`}>
                      <PontIcon size={12} /> {pont.label}
                    </span>
                  </div>
                </div>
                {hasPendingSolicitacao('projeto', projeto.id) && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 animate-pulse">Aguardando aprovação</span>
                )}
                <div className="flex gap-2 shrink-0 items-center">
                  <button type="button" onClick={openHelpModal}
                    className="flex items-center gap-1.5 text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200 px-2.5 py-1.5 rounded-lg hover:bg-orange-100 transition-colors"
                    title="Guia de preenchimento">
                    <BookOpen size={14} /> Guia
                  </button>
                  <button type="button" onClick={() => setHelpType('permissoes')} className="flex items-center gap-1.5 text-xs text-sedec-500 hover:text-sedec-700 bg-sedec-50 hover:bg-sedec-100 px-2.5 py-1.5 rounded-lg transition-colors font-medium border border-sedec-200" title="Regras de permissão">
                    <HelpCircle size={14} /> Permissões
                  </button>
                  {isAdminOrMaster && (
                    <button onClick={toggleHibernando}
                      className={`flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg transition-colors font-medium ${projeto.status === 'hibernando' ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                      title={projeto.status === 'hibernando' ? 'Reativar projeto' : 'Hibernar projeto'}>
                      <Pause size={15} /> {projeto.status === 'hibernando' ? 'Reativar' : 'Hibernar'}
                    </button>
                  )}
                  {canEditProjeto && (
                    <>
                      <button onClick={startEditProjeto} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-medium" title="Editar"><Edit3 size={15} /> Editar</button>
                      {(isAdminOrMaster || canEditProjeto) && (
                        <button onClick={deleteProject} className="flex items-center gap-1 text-sm bg-red-50 text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors font-medium" title="Excluir"><Trash2 size={15} /> Excluir</button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {(projeto.responsavel_id || projeto.data_inicio) && (
                <div className="mb-5 flex flex-wrap gap-x-6 gap-y-1">
                  {projeto.responsavel_id && (
                    <p className="text-sm text-gray-600"><span className="font-semibold text-gray-700">Líder:</span> {eligibleUsers.find(u => u.id === projeto.responsavel_id)?.nome || '—'}</p>
                  )}
                  {projeto.data_inicio && (
                    <p className="text-sm text-gray-600"><span className="font-semibold text-gray-700">Início:</span> {formatDateBR(projeto.data_inicio)}</p>
                  )}
                </div>
              )}

              <div className="space-y-4 mb-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm">
                  <h3 className="font-bold text-gray-800 flex items-center gap-1.5 mb-1.5"><AlertTriangle size={15} className="text-orange-500" /> Problema Identificado — POR QUE o projeto existe</h3>
                  <ul className="space-y-1.5 mt-2">
                    {projeto.problema_resolve?.split('\n').filter((line: string) => line.trim() !== '').map((line: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-orange-500 font-bold mt-0.5">•</span>
                        <span className="text-gray-700 leading-relaxed">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {projeto.causas && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm">
                    <h3 className="font-bold text-gray-800 flex items-center gap-1.5 mb-1.5"><AlertTriangle size={15} className="text-yellow-500" /> Causas do Problema — O QUE origina essa situação</h3>
                    <ul className="space-y-1.5 mt-2">
                      {projeto.causas.split('\n').filter((line: string) => line.trim() !== '').map((line: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-yellow-500 font-bold mt-0.5">•</span>
                          <span className="text-gray-700 leading-relaxed">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {projeto.consequencias_diretas && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm">
                    <h3 className="font-bold text-gray-800 flex items-center gap-1.5 mb-1.5"><AlertTriangle size={15} className="text-red-500" /> Consequências Diretas do Problema</h3>
                    <ul className="space-y-1.5 mt-2">
                      {projeto.consequencias_diretas.split('\n').filter((line: string) => line.trim() !== '').map((line: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-red-500 font-bold mt-0.5">•</span>
                          <span className="text-gray-700 leading-relaxed">{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {projeto.objetivos && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm">
                    <h3 className="font-bold text-gray-800 flex items-center gap-1.5 mb-1.5"><CheckCircle size={15} className="text-green-500" /> Objetivo do Projeto — PARA QUE ele existe</h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{projeto.objetivos}</p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-sm">
                  <h3 className="font-bold text-gray-800 flex items-center gap-1.5 mb-1.5"><CheckCircle size={15} className="text-blue-500" /> Descrição da Solução Proposta — O QUE será feito</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{projeto.descricao}</p>
                </div>
              </div>

              {indicadores.length > 0 && (
                <div className="mb-5 bg-green-50/50 rounded-xl p-4 border border-green-100 text-sm">
                  <h3 className="font-bold text-green-800 flex items-center gap-1.5 mb-2">🎯 Indicador(es) de sucesso - Como saberemos que funcionou?</h3>
                  <div className="space-y-3">
                    {indicadores.map((ind: any, idx: number) => (
                      <div key={ind.id || idx} className="bg-white/70 rounded-lg p-3 border border-green-100">
                        {ind.nome && <div className="font-semibold text-gray-800 mb-1">{ind.nome}</div>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                          {ind.formula && <div><span className="text-gray-500 text-xs">Fórmula:</span> <span className="text-gray-700">{ind.formula}</span></div>}
                          {ind.fonte_dados && <div><span className="text-gray-500 text-xs">Fonte:</span> <span className="text-gray-700">{ind.fonte_dados}</span></div>}
                          {ind.periodicidade && <div><span className="text-gray-500 text-xs">Periodicidade:</span> <span className="text-gray-700">{ind.periodicidade}</span></div>}
                          {ind.unidade_medida && <div><span className="text-gray-500 text-xs">Unidade:</span> <span className="text-gray-700">{ind.unidade_medida}</span></div>}
                          {ind.responsavel && <div><span className="text-gray-500 text-xs">Responsável:</span> <span className="text-gray-700">{ind.responsavel}</span></div>}
                          {ind.meta && <div><span className="text-gray-500 text-xs">Meta:</span> <span className="text-gray-700">{ind.meta}</span></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {projeto.indicador_sucesso && indicadores.length === 0 && (
                <div className="mb-5 bg-green-50/50 rounded-xl p-4 border border-green-100 text-sm">
                  <h3 className="font-bold text-green-800 flex items-center gap-1.5 mb-1.5">🎯 Indicador(es) de sucesso - Como saberemos que funcionou?</h3>
                  <ul className="space-y-1.5 mt-2">
                    {projeto.indicador_sucesso?.split('\n').filter((line: string) => line.trim() !== '').map((line: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-green-600 font-bold mt-0.5">•</span>
                        <span className="text-gray-700 leading-relaxed">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {riscos.length > 0 && (
                <div className="mb-5 bg-amber-50/50 rounded-xl p-4 border border-amber-100 text-sm">
                  <h3 className="font-bold text-amber-800 flex items-center gap-1.5 mb-2">⚠️ Matriz de Riscos</h3>
                  <div className="space-y-3">
                    {riscos.map((risco: any, idx: number) => (
                      <div key={risco.id || idx} className="bg-white/70 rounded-lg p-3 border border-amber-100">
                        {risco.natureza && <div className="font-semibold text-gray-800 mb-1">{risco.natureza}</div>}
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {risco.probabilidade && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-500 text-xs">Probabilidade:</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                risco.probabilidade === 'alta' ? 'bg-red-100 text-red-700' :
                                risco.probabilidade === 'media' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {risco.probabilidade === 'media' ? 'Média' : risco.probabilidade.charAt(0).toUpperCase() + risco.probabilidade.slice(1)}
                              </span>
                            </div>
                          )}
                          {risco.impacto && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-500 text-xs">Impacto:</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                risco.impacto === 'alto' ? 'bg-red-100 text-red-700' :
                                risco.impacto === 'medio' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {risco.impacto === 'medio' ? 'Médio' : risco.impacto.charAt(0).toUpperCase() + risco.impacto.slice(1)}
                              </span>
                            </div>
                          )}
                          {risco.medida_resposta && <div><span className="text-gray-500 text-xs">Medida de resposta:</span> <span className="text-gray-700">{risco.medida_resposta}</span></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {projeto.dependencias_projetos && (
                <div className="mb-5 bg-purple-50/50 rounded-xl p-4 border border-purple-100 text-sm">
                  <h3 className="font-bold text-purple-800 flex items-center gap-1.5 mb-1.5">🔗 Dependências críticas do projeto</h3>
                  <ul className="space-y-1.5 mt-2">
                    {projeto.dependencias_projetos.split('\n').filter((line: string) => line.trim() !== '').map((line: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-purple-600 font-bold mt-0.5">•</span>
                        <span className="text-gray-700 leading-relaxed">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 pt-5 border-t border-gray-100">
                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><ListPlus size={14} /> Ações estratégicas vinculadas</h3>
                  <div className="flex flex-col gap-2">
                    {projeto.projeto_acoes?.map((pa: any) => (
                      <div key={pa.acao_estrategica?.id} className="bg-white border border-gray-200 text-gray-700 px-3 py-2.5 rounded-lg text-sm flex items-start gap-3 shadow-sm transition-all hover:bg-gray-50">
                        <span className="font-bold text-sedec-600 shrink-0 bg-sedec-50 px-2 py-0.5 rounded text-xs border border-sedec-100 mt-0.5">AE {pa.acao_estrategica?.numero}</span>
                        <span className="leading-snug">{pa.acao_estrategica?.nome}</span>
                      </div>
                    ))}
                    {(!projeto.projeto_acoes || projeto.projeto_acoes.length === 0) && (
                      <span className="text-sm text-gray-400 italic">Nenhuma ação vinculada.</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5"><PackagePlus size={14} /> Tipo de Ação</h3>
                  {projeto.tipo_acao && projeto.tipo_acao.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {projeto.tipo_acao.map((tipo: string) => (
                        <span key={tipo} className="bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1.5 rounded-md text-xs font-semibold shadow-sm">
                          {tipo}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Nenhum tipo definido.</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mensagens do Projeto */}
      {profile && projeto && !editingProjeto && (() => {
        // Compute setores elegíveis para mensagens
        const setorIdsElegiveis = new Set<number>()
        // Setor líder
        if (projeto.setor_lider_id) setorIdsElegiveis.add(projeto.setor_lider_id)
        // Setores das entregas
        for (const e of (projeto.entregas || [])) {
          if (e.orgao_responsavel_setor_id) setorIdsElegiveis.add(e.orgao_responsavel_setor_id)
          // Participantes de entrega
          for (const p of (e.entrega_participantes || [])) {
            if (p.setor_id) setorIdsElegiveis.add(p.setor_id)
          }
          // Atividades
          for (const a of (e.atividades || [])) {
            for (const ap of (a.atividade_participantes || [])) {
              if (ap.setor_id) setorIdsElegiveis.add(ap.setor_id)
            }
          }
        }
        // Setores dos responsáveis (via profiles)
        const userIdsEnvolvidos = new Set<string>()
        if (projeto.responsavel_id) userIdsEnvolvidos.add(projeto.responsavel_id)
        for (const e of (projeto.entregas || [])) {
          if (e.responsavel_entrega_id) userIdsEnvolvidos.add(e.responsavel_entrega_id)
          for (const a of (e.atividades || [])) {
            if (a.responsavel_atividade_id) userIdsEnvolvidos.add(a.responsavel_atividade_id)
            for (const ap of (a.atividade_participantes || [])) {
              if (ap.user_id) userIdsEnvolvidos.add(ap.user_id)
            }
          }
        }
        // Adicionar setores dos usuários envolvidos
        Array.from(userIdsEnvolvidos).forEach(uid => {
          const u = eligibleUsers.find(eu => eu.id === uid)
          if (u?.setor_id) setorIdsElegiveis.add(u.setor_id)
        })
        // Gabinete de Projetos (masters/admins) sempre é destinatário possível
        eligibleUsers.filter(u => u.role === 'master' || u.role === 'admin').forEach(u => {
          if (u.setor_id) setorIdsElegiveis.add(u.setor_id)
        })

        const setoresElegiveisArr = setores.filter((s: any) => setorIdsElegiveis.has(s.id))

        // Check if current user can send
        const isAdmMst = profile.role === 'admin' || profile.role === 'master'
        const meuSetorElegivel = profile.setor_id ? setorIdsElegiveis.has(profile.setor_id) : false
        const euEnvolvido = userIdsEnvolvidos.has(profile.id)
        const canSend = isAdmMst || (profile.role === 'gestor' && (meuSetorElegivel || euEnvolvido))

        return (
          <ProjetoMensagens
            projetoId={projeto.id}
            profile={profile}
            setoresElegiveis={setoresElegiveisArr}
            canSendMessage={canSend}
          />
        )
      })()}

      {/* Gantt Chart */}
      {projeto.entregas?.some((e: any) => e.data_final_prevista) && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Cronograma de Entregas</h2>
          <GanttChart entregas={projeto.entregas} dataInicio={projeto.data_inicio} />
        </div>
      )}

      {/* Entregas + Atividades */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-700">Entregas</h2>
          <button type="button" onClick={() => setHelpType('entrega')} className="text-gray-400 hover:text-orange-500 transition-colors" title="O que é uma Entrega?"><HelpCircle size={16} /></button>
          {projeto.entregas?.length > 0 && (
            <button onClick={toggleExpandAll}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 ml-2 px-2 py-1 rounded hover:bg-gray-100 transition-colors">
              {allExpanded ? <><ChevronUp size={14} /> Recolher todas</> : <><ChevronDown size={14} /> Expandir todas</>}
            </button>
          )}
        </div>
        {canCreateProjeto && (
          <button onClick={addNewEntrega}
            className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium">
            <PackagePlus size={16} /> Nova entrega
          </button>
        )}
      </div>

      {/* Formulário de nova entrega (inline, no topo) */}
      {showNewEntregaForm && (
        <div className="mb-4 bg-white rounded-xl border-2 border-blue-400 ring-2 ring-blue-100 shadow-md overflow-hidden">
          <div className="p-4 bg-blue-50/30">
            <div className="space-y-3">
              <p className="text-sm font-bold text-blue-800 mb-2">Nova entrega</p>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nome *</label>
                <input type="text" value={newEntregaForm.nome} onChange={ev => setNewEntregaForm({ ...newEntregaForm, nome: ev.target.value })}
                  className="input-field text-sm" placeholder="Nome da entrega" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Descrição</label>
                <textarea value={newEntregaForm.descricao} onChange={ev => setNewEntregaForm({ ...newEntregaForm, descricao: ev.target.value })}
                  className="input-field text-sm resize-y" rows={2} placeholder="Descreva esta entrega" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Critérios de aceite</label>
                <textarea value={newEntregaForm.criterios_aceite || ''}
                  onChange={ev => setNewEntregaForm({ ...newEntregaForm, criterios_aceite: ev.target.value })}
                  placeholder="Minuta apresentada e aprovada pelo Superintendente" className="input-field text-xs resize-y" rows={2} />
              </div>

              {/* Órgão responsável + Responsável */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Órgão responsável *</label>
                  <select
                    value={newEntregaForm.orgao_responsavel_setor_id || ''}
                    onChange={ev => {
                      const newSetorId = ev.target.value ? parseInt(ev.target.value) : null
                      const currentResp = newEntregaForm.responsavel_entrega_id
                      const respUser = currentResp ? eligibleUsers.find(u => u.id === currentResp) : null
                      const shouldClear = currentResp && newSetorId && respUser && respUser.setor_id !== newSetorId
                      setNewEntregaForm({ ...newEntregaForm, orgao_responsavel_setor_id: newSetorId, ...(shouldClear ? { responsavel_entrega_id: '' } : {}) })
                    }}
                    className="input-field text-xs">
                    <option value="">Selecione...</option>
                    {setoresDisponiveis.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.codigo} — {s.nome_completo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Responsável pela entrega *</label>
                  {!newEntregaForm.orgao_responsavel_setor_id ? (
                    <p className="text-[10px] text-gray-400 mt-1 italic px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">Selecione o órgão responsável primeiro.</p>
                  ) : (
                    <UserAutocompleteSelect
                      value={newEntregaForm.responsavel_entrega_id}
                      onChange={val => setNewEntregaForm({ ...newEntregaForm, responsavel_entrega_id: val })}
                      users={eligibleUsers.filter(u => u.role !== 'usuario' && (u.id === newEntregaForm.responsavel_entrega_id || u.setor_id === newEntregaForm.orgao_responsavel_setor_id))}
                      placeholder="Selecione o responsável..."
                      onRegisterNew={() => setShowGestorModal(['gestor'])}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[160px]">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Status</label>
                    <select value={newEntregaForm.status} onChange={ev => setNewEntregaForm({ ...newEntregaForm, status: ev.target.value })}
                      className={`w-full px-3 py-2 rounded-lg text-xs font-medium border-2 focus:outline-none focus:ring-2 focus:ring-sedec-500 ${newEntregaForm.status === 'resolvida' ? 'border-green-400 bg-green-50 text-green-800' :
                        newEntregaForm.status === 'cancelada' ? 'border-red-300 bg-red-50 text-red-800' :
                          newEntregaForm.status === 'em_andamento' ? 'border-blue-300 bg-blue-50 text-blue-800' :
                            newEntregaForm.status === 'aguardando' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' :
                              'border-gray-300 bg-white text-gray-700'
                        }`}>
                      {Object.entries(STATUS_ENTREGA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div className="w-[140px]">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Data Início (Op.)</label>
                    <input type="date" value={newEntregaForm.data_inicio || ''}
                      onChange={ev => setNewEntregaForm({ ...newEntregaForm, data_inicio: ev.target.value })}
                      className="w-full input-field text-xs text-gray-500" />
                  </div>
                  <div className="w-[180px]">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Quinzena</label>
                    <select value={newEntregaForm.data_final_prevista}
                      onChange={ev => setNewEntregaForm({ ...newEntregaForm, data_final_prevista: ev.target.value })}
                      className="w-full input-field text-xs">
                      <option value="">Sem prazo</option>
                      {QUINZENAS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Motivo do status</label>
                    <input type="text" value={newEntregaForm.motivo_status} onChange={ev => setNewEntregaForm({ ...newEntregaForm, motivo_status: ev.target.value })}
                      placeholder="Opcional" className="input-field text-xs" />
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] ${newEntregaForm.status === 'aguardando' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  newEntregaForm.status === 'em_andamento' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                    newEntregaForm.status === 'resolvida' ? 'bg-green-50 text-green-600 border border-green-100' :
                      newEntregaForm.status === 'cancelada' ? 'bg-red-50 text-red-500 border border-red-100' :
                        'bg-gray-50 text-gray-500 border border-gray-100'
                  }`}>
                  <Info size={12} className="shrink-0" />
                  <span>{STATUS_ENTREGA[newEntregaForm.status]?.hint}</span>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Dependências críticas</label>
                <textarea value={newEntregaForm.dependencias_criticas}
                  onChange={ev => setNewEntregaForm({ ...newEntregaForm, dependencias_criticas: ev.target.value })}
                  placeholder="Ex: Depende de aprovação do projeto de lei XPTO" className="input-field text-xs resize-y leading-relaxed" rows={3} />
                <p className="text-[10px] text-amber-600 mt-1">Caso haja alguma dependência crítica que dependa de outro setor, ajuste com ele antes de inserí-la.</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Participantes</span>
                  <button type="button" onClick={() => setNewEntregaForm((prev: any) => ({
                    ...prev, participantes: [...prev.participantes, { setor_id: null, tipo_participante: 'setor', papel: '' }]
                  }))} className="text-[11px] text-orange-500 font-medium">+ Participante</button>
                </div>
                {newEntregaForm.participantes?.map((p: any, i: number) =>
                  renderEntregaParticipanteEditRow(p, i, newEntregaForm.participantes,
                    (idx, f, v) => setNewEntregaForm((prev: any) => ({
                      ...prev, participantes: prev.participantes.map((pp: any, j: number) => j === idx ? { ...pp, [f]: v } : pp)
                    })),
                    (idx) => {
                      if (confirm('Remover participante?')) setNewEntregaForm((prev: any) => ({
                        ...prev, participantes: prev.participantes.filter((_: any, j: number) => j !== idx)
                      }))
                    }
                  )
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={saveNewEntrega} disabled={saving}
                  className="flex items-center gap-1 text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg"><Save size={13} /> Salvar</button>
                <button onClick={() => setShowNewEntregaForm(false)}
                  className="flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5"><X size={13} /> Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(!projeto.entregas || projeto.entregas.length === 0) && !showNewEntregaForm && (
        <div className="text-center py-8 text-gray-400 text-sm">Nenhuma entrega cadastrada.</div>
      )}

      <div className="space-y-6">
        {projeto.entregas?.map((e: any, entregaIndex: number) => {
          const isEditing = editingEntrega === e.id
          const now = new Date(); now.setHours(0, 0, 0, 0)
          const isAtrasada = e.data_final_prevista && e.status !== 'resolvida' && e.status !== 'cancelada' && new Date(e.data_final_prevista) < now
          const st = STATUS_ENTREGA[e.status] || STATUS_ENTREGA.aberta
          const ePerms = getEntregaPerms(e)

          return (
            <div key={e.id} className={`bg-white rounded-xl border overflow-hidden ${isEditing ? 'border-blue-400 ring-2 ring-blue-100 shadow-md' : isAtrasada ? 'border-red-300' : 'border-gray-200'
              }`}>
              {/* Entrega header */}
              <div className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 ${isEditing ? 'bg-blue-50/50' : ''}`}
                onClick={() => {
                  if (isEditing) {
                    setEditingEntrega(null)
                    setEditingAtividade(null)
                  } else {
                    if (expanded[e.id]) {
                      // Ao colapsar, limpar edição de atividade dentro desta entrega
                      setEditingAtividade(null)
                    }
                    setExpanded(prev => ({ ...prev, [e.id]: !prev[e.id] }))
                  }
                }}>
                <div className="w-7 h-7 rounded-full bg-sedec-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {entregaIndex + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-800">{e.nome}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.bg} ${st.color}`}>{st.label}</span>
                    {isAtrasada && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Atrasada</span>}
                    {hasPendingSolicitacao('entrega', e.id) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 animate-pulse">Aguardando aprovação</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    {e.data_inicio && <span>Início: {formatDateBR(e.data_inicio)}</span>}
                    {e.data_final_prevista && <span>Prazo: {formatQuinzena(e.data_final_prevista)}</span>}
                    <span>{e.atividades?.length || 0} atividade(s)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(ePerms.canFull || ePerms.canEditLimited || ePerms.canEditDatas) && (
                    <>
                      <button onClick={(ev) => { ev.stopPropagation(); isEditing ? setEditingEntrega(null) : startEditEntrega(e) }}
                        className="text-gray-400 hover:text-orange-500"><Edit3 size={15} /></button>
                      {ePerms.canFull && <button onClick={(ev) => { ev.stopPropagation(); deleteEntrega(e) }}
                        className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>}
                    </>
                  )}
                  {expanded[e.id] ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
              </div>

              {/* Entrega expanded content */}
              {(expanded[e.id] || isEditing) && (
                <div className={`border-t p-4 ${isEditing ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'}`}>
                  {isEditing ? (
                    <div className="space-y-3">
                      {(() => {
                        return (<>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nome</label>
                            <input type="text" value={editForm.nome} onChange={ev => setEditForm({ ...editForm, nome: ev.target.value })}
                              disabled={!ePerms.canFull} className="input-field text-sm" placeholder="Nome da entrega" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Descrição</label>
                            <textarea value={editForm.descricao} onChange={ev => setEditForm({ ...editForm, descricao: ev.target.value })}
                              disabled={!ePerms.canFull} className="input-field text-sm resize-y" rows={2} placeholder="Descreva esta entrega" />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Critérios de aceite</label>
                            <textarea value={editForm.criterios_aceite || ''}
                              onChange={ev => setEditForm({ ...editForm, criterios_aceite: ev.target.value })}
                              disabled={!(ePerms.canFull || ePerms.canEditLimited)} placeholder="Minuta apresentada e aprovada pelo Superintendente" className="input-field text-xs resize-y" rows={2} />
                          </div>

                          {/* Órgão responsável + Responsável */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Órgão responsável *</label>
                              <select
                                value={editForm.orgao_responsavel_setor_id || ''}
                                onChange={ev => {
                                  const newSetorId = ev.target.value ? parseInt(ev.target.value) : null
                                  const currentResp = editForm.responsavel_entrega_id
                                  const respUser = currentResp ? eligibleUsers.find(u => u.id === currentResp) : null
                                  const shouldClear = currentResp && newSetorId && respUser && respUser.setor_id !== newSetorId
                                  setEditForm({ ...editForm, orgao_responsavel_setor_id: newSetorId, ...(shouldClear ? { responsavel_entrega_id: '' } : {}) })
                                }}
                                disabled={!(ePerms.canFull || ePerms.canEditLimited)}
                                className="input-field text-xs">
                                <option value="">Selecione...</option>
                                {setoresDisponiveis.map((s: any) => (
                                  <option key={s.id} value={s.id}>{s.codigo} — {s.nome_completo}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Responsável pela entrega *</label>
                              {!editForm.orgao_responsavel_setor_id ? (
                                <p className="text-[10px] text-gray-400 mt-1 italic px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">Selecione o órgão responsável primeiro.</p>
                              ) : (
                                <UserAutocompleteSelect
                                  value={editForm.responsavel_entrega_id}
                                  onChange={val => setEditForm({ ...editForm, responsavel_entrega_id: val })}
                                  users={eligibleUsers.filter(u => u.role !== 'usuario' && (u.id === editForm.responsavel_entrega_id || u.setor_id === editForm.orgao_responsavel_setor_id))}
                                  placeholder="Selecione o responsável..."
                                  disabled={!(ePerms.canFull || ePerms.canEditLimited)}
                                  onRegisterNew={() => setShowGestorModal(['gestor'])}
                                />
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-end gap-3">
                              {/* Status — destaque visual */}
                              <div className="min-w-[160px]">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Status</label>
                                <select value={editForm.status} onChange={ev => setEditForm({ ...editForm, status: ev.target.value })}
                                  disabled={!(ePerms.canFull || ePerms.canEditLimited)}
                                  className={`w-full px-3 py-2 rounded-lg text-xs font-medium border-2 focus:outline-none focus:ring-2 focus:ring-sedec-500 ${editForm.status === 'resolvida' ? 'border-green-400 bg-green-50 text-green-800' :
                                    editForm.status === 'cancelada' ? 'border-red-300 bg-red-50 text-red-800' :
                                      editForm.status === 'em_andamento' ? 'border-blue-300 bg-blue-50 text-blue-800' :
                                        editForm.status === 'aguardando' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' :
                                          'border-gray-300 bg-white text-gray-700'
                                    }`}>
                                  {Object.entries(STATUS_ENTREGA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                </select>
                              </div>

                              <div className="w-[140px]">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Data Início (Op.)</label>
                                <input type="date" value={editForm.data_inicio || ''}
                                  onChange={ev => setEditForm({ ...editForm, data_inicio: ev.target.value })}
                                  disabled={!ePerms.canEditDatas}
                                  className="w-full input-field text-xs text-gray-500" />
                              </div>

                              {/* Quinzena — compacto */}
                              <div className="w-[180px]">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Quinzena</label>
                                <select value={editForm.data_final_prevista}
                                  onChange={ev => setEditForm({ ...editForm, data_final_prevista: ev.target.value })}
                                  disabled={!ePerms.canEditDatas}
                                  className="w-full input-field text-xs">
                                  <option value="">Sem prazo</option>
                                  {QUINZENAS.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                                </select>
                              </div>

                              {/* Motivo */}
                              <div className="flex-1 min-w-[180px]">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Motivo do status</label>
                                <input type="text" value={editForm.motivo_status} onChange={ev => setEditForm({ ...editForm, motivo_status: ev.target.value })}
                                  disabled={!(ePerms.canFull || ePerms.canEditLimited)} placeholder="Opcional" className="input-field text-xs" />
                              </div>
                            </div>
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] ${editForm.status === 'aguardando' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              editForm.status === 'em_andamento' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                editForm.status === 'resolvida' ? 'bg-green-50 text-green-600 border border-green-100' :
                                  editForm.status === 'cancelada' ? 'bg-red-50 text-red-500 border border-red-100' :
                                    'bg-gray-50 text-gray-500 border border-gray-100'
                              }`}>
                              <Info size={12} className="shrink-0" />
                              <span>{STATUS_ENTREGA[editForm.status]?.hint}</span>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-1">Dependências críticas</label>
                            <textarea value={editForm.dependencias_criticas}
                              onChange={ev => setEditForm({ ...editForm, dependencias_criticas: ev.target.value })}
                              disabled={!(ePerms.canFull || ePerms.canEditLimited)} placeholder="Ex: Depende de aprovação do projeto de lei XPTO" className="input-field text-xs resize-y leading-relaxed" rows={3} />
                            <p className="text-[10px] text-amber-600 mt-1">Caso haja alguma dependência crítica que dependa de outro setor, ajuste com ele antes de inserí-la.</p>
                          </div>

                          {/* Participantes */}
                          {(ePerms.canFull || ePerms.canEditLimited) && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-gray-600">Participantes</span>
                                <button type="button" onClick={() => setEditForm((prev: any) => ({
                                  ...prev, participantes: [...prev.participantes, { setor_id: null, tipo_participante: 'setor', papel: '' }]
                                }))} className="text-[11px] text-orange-500 font-medium">+ Participante</button>
                              </div>
                              {editForm.participantes?.map((p: any, i: number) =>
                                renderEntregaParticipanteEditRow(p, i, editForm.participantes,
                                  (idx, f, v) => setEditForm((prev: any) => ({
                                    ...prev, participantes: prev.participantes.map((pp: any, j: number) => j === idx ? { ...pp, [f]: v } : pp)
                                  })),
                                  (idx) => {
                                    if (confirm('Remover participante?')) setEditForm((prev: any) => ({
                                      ...prev, participantes: prev.participantes.filter((_: any, j: number) => j !== idx)
                                    }))
                                  }
                                )
                              )}
                            </div>
                          )}

                          <ResultadosSection
                            owner={{ kind: 'entrega', entregaId: e.id }}
                            descricao={editForm.resultado_descricao || ''}
                            onDescricaoChange={v => setEditForm({ ...editForm, resultado_descricao: v })}
                            arquivoPath={editForm.resultado_arquivo_path || null}
                            arquivoNome={editForm.resultado_arquivo_nome || null}
                            arquivoTamanho={editForm.resultado_arquivo_tamanho || null}
                            onArquivoChange={meta => setEditForm({
                              ...editForm,
                              resultado_arquivo_path: meta?.path || null,
                              resultado_arquivo_nome: meta?.nome || null,
                              resultado_arquivo_tamanho: meta?.tamanho || null,
                            })}
                            disabled={!(ePerms.canFull || ePerms.canEditLimited)}
                          />

                          <div className="flex gap-2">
                            <button onClick={() => saveEditEntrega(e.id)} disabled={saving}
                              className="flex items-center gap-1 text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg"><Save size={13} /> Salvar</button>
                            <button onClick={() => setEditingEntrega(null)}
                              className="flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5"><X size={13} /> Cancelar</button>
                          </div>
                        </>)
                      })()}
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">{e.descricao}</p>
                      {e.criterios_aceite && (
                        <div className="mb-3">
                          <span className="text-sm font-semibold text-gray-700 block mb-1">Critérios de aceite:</span>
                          <ul className="space-y-1">
                            {e.criterios_aceite.split('\n').filter((l: string) => l.trim() !== '').map((line: string, i: number) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                                <span className="text-gray-400 font-bold mt-0.5">•</span>
                                <span className="leading-relaxed">{line}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {e.dependencias_criticas && (
                        <div className="mb-3">
                          <span className="text-sm font-semibold text-gray-700 block mb-1">Dependências críticas:</span>
                          <ul className="space-y-1">
                            {e.dependencias_criticas.split('\n').filter((l: string) => l.trim() !== '').map((line: string, i: number) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                                <span className="text-gray-400 font-bold mt-0.5">•</span>
                                <span className="leading-relaxed">{line}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {e.motivo_status && (
                        <p className="text-xs text-gray-600 mb-2"><span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Motivo do status:</span> {e.motivo_status}</p>
                      )}

                      {/* Órgão responsável + Responsável */}
                      {(e.orgao_responsavel_setor_id || e.responsavel_entrega_id) && (
                        <div className="flex flex-wrap gap-4 mb-3 text-xs">
                          {e.orgao_responsavel_setor_id && (() => {
                            const p = e.entrega_participantes?.find((pp: any) => pp.tipo_participante === 'setor' && pp.setor_id === e.orgao_responsavel_setor_id)
                            return (
                              <div>
                                <span className="font-semibold text-gray-700">Órgão responsável: </span>
                                <span className="text-gray-600">{p?.setor?.codigo ? `${p.setor.codigo} — ${p.setor.nome_completo}` : setores.find((s: any) => s.id === e.orgao_responsavel_setor_id)?.codigo || 'Setor'}</span>
                              </div>
                            )
                          })()}
                          {e.responsavel_entrega_id && (
                            <div>
                              <span className="font-semibold text-gray-700">Responsável: </span>
                              <span className="text-gray-600">{eligibleUsers.find(u => u.id === e.responsavel_entrega_id)?.nome || '—'}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Participantes */}
                      {e.entrega_participantes?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {e.entrega_participantes.map((p: any) => (
                            <span key={p.id} className="text-xs bg-gray-100 px-2 py-1 rounded">
                              <span className="font-medium">{participanteLabel(p)}</span>: {p.papel}
                            </span>
                          ))}
                        </div>
                      )}

                      {(e.resultado_descricao || e.resultado_arquivo_path) && (
                        <div className="mt-3 mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/60 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="text-emerald-600" size={16} />
                            <h4 className="text-sm font-bold text-emerald-900">Resultados e Produtos</h4>
                          </div>
                          {e.resultado_descricao && (
                            <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{e.resultado_descricao}</p>
                          )}
                          {e.resultado_arquivo_path && (
                            <a
                              href={`/api/resultados/download?path=${encodeURIComponent(e.resultado_arquivo_path)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 px-2 py-1 rounded"
                            >
                              <FileText size={13} /> {e.resultado_arquivo_nome || 'Baixar PDF do resultado'}
                            </a>
                          )}
                        </div>
                      )}

                      {/* Atividades Nesting Container */}
                      <div className="mt-5 bg-gray-50/70 border border-gray-200 rounded-xl p-4 ml-2 sm:ml-4 shadow-inner relative">
                        {/* Indicador visual de aninhamento */}
                        <div className="absolute -left-2 top-6 bottom-6 w-0.5 bg-gray-200 rounded-full hidden sm:block"></div>

                        <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
                              <ListPlus size={16} /> Atividades da Entrega
                            </h4>
                            <button type="button" onClick={() => setHelpType('atividade')} className="text-gray-400 hover:text-orange-500 transition-colors" title="O que é uma Atividade?"><HelpCircle size={14} /></button>
                          </div>
                          {ePerms.canCreateAtividades && (
                            <button onClick={() => addNewAtividade(e.id)}
                              className="text-xs bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all shadow-sm">
                              <Plus size={14} /> Adicionar
                            </button>
                          )}
                        </div>

                        {(!e.atividades || e.atividades.length === 0) && (
                          <div className="flex items-start gap-2 text-xs text-gray-500 bg-white border border-gray-100 shadow-sm rounded-lg p-3">
                            <Info size={14} className="mt-0.5 text-blue-500 shrink-0" />
                            <span>Nenhuma atividade cadastrada. Exemplos: reunião de alinhamento, pesquisa documental, elaboração de rascunho.</span>
                          </div>
                        )}

                        <div className="space-y-3 mt-2">
                          {e.atividades?.map((a: any, ativIndex: number) => {
                            const isEditA = editingAtividade === a.id
                            const aPerms = getAtividadePerms(a, ePerms)
                            return (
                              <div key={a.id} className={`rounded-xl border transition-all ${isEditA ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100 shadow-md' : 'bg-white border-gray-200 shadow-sm hover:shadow-md'}`}>
                                <div className="p-4">
                                  {isEditA ? (
                                    <div className="space-y-2">
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Nome</label>
                                        <input type="text" value={editForm.nome} onChange={ev => setEditForm({ ...editForm, nome: ev.target.value })}
                                          disabled={!aPerms.canFull} className="input-field text-xs" placeholder="Nome da atividade" />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Descrição</label>
                                        <input type="text" value={editForm.descricao} onChange={ev => setEditForm({ ...editForm, descricao: ev.target.value })}
                                          disabled={!aPerms.canFull} className="input-field text-xs" placeholder="Descreva esta atividade" />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Responsável pela atividade</label>
                                        <UserAutocompleteSelect
                                          value={editForm.responsavel_atividade_id}
                                          onChange={val => setEditForm({ ...editForm, responsavel_atividade_id: val })}
                                          users={(() => {
                                            if (!isAdminOrMaster) return eligibleUsers.filter(u => u.role !== 'usuario' && (u.id === editForm.responsavel_atividade_id || u.setor_id === profile?.setor_id))
                                            const entregaSetorIds = new Set((editForm.entrega_participantes || []).filter((ep: any) => ep.tipo_participante === 'setor' && ep.setor_id).map((ep: any) => ep.setor_id))
                                            return eligibleUsers.filter(u => u.role !== 'usuario' && (u.id === editForm.responsavel_atividade_id || (u.setor_id && entregaSetorIds.has(u.setor_id))))
                                          })()}
                                          placeholder="Selecione o responsável..."
                                          disabled={!(aPerms.canFull || aPerms.canEditLimited)}
                                          onRegisterNew={() => setShowGestorModal(['gestor'])}
                                        />
                                      </div>

                                      <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-end gap-2">
                                          <div className="w-[140px]">
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Status</label>
                                            <select value={editForm.status} onChange={ev => setEditForm({ ...editForm, status: ev.target.value })}
                                              disabled={!(aPerms.canFull || aPerms.canEditLimited)}
                                              className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium border-2 focus:outline-none focus:ring-2 focus:ring-sedec-500 ${editForm.status === 'resolvida' ? 'border-green-400 bg-green-50 text-green-800' :
                                                editForm.status === 'cancelada' ? 'border-red-300 bg-red-50 text-red-800' :
                                                  editForm.status === 'em_andamento' ? 'border-blue-300 bg-blue-50 text-blue-800' :
                                                    editForm.status === 'aguardando' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' :
                                                      'border-gray-300 bg-white text-gray-700'
                                                }`}>
                                              {Object.entries(STATUS_ENTREGA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                            </select>
                                          </div>

                                          <div className="w-[140px]">
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Data prevista <span className="text-gray-400 font-normal">(prazo para conclusão)</span></label>
                                            <input type="date" value={editForm.data_prevista || ''}
                                              max={editForm.entrega_data_final || undefined}
                                              disabled={!aPerms.canEditDatas}
                                              onChange={ev => {
                                                const nd = ev.target.value
                                                if (nd && editForm.entrega_data_final && nd > editForm.entrega_data_final) {
                                                  alert(`A data não pode ser posterior à quinzena da entrega (${editForm.entrega_data_final}).`)
                                                  return
                                                }
                                                setEditForm({ ...editForm, data_prevista: nd })
                                              }}
                                              className="w-full input-field text-xs" />
                                          </div>

                                          <div className="flex-1 min-w-[140px]">
                                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Motivo</label>
                                            <input type="text" value={editForm.motivo_status || ''} onChange={ev => setEditForm({ ...editForm, motivo_status: ev.target.value })}
                                              disabled={!(aPerms.canFull || aPerms.canEditLimited)} placeholder="Opcional" className="input-field text-xs" />
                                          </div>
                                        </div>
                                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] ${editForm.status === 'aguardando' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                          editForm.status === 'em_andamento' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                            editForm.status === 'resolvida' ? 'bg-green-50 text-green-600 border border-green-100' :
                                              editForm.status === 'cancelada' ? 'bg-red-50 text-red-500 border border-red-100' :
                                                'bg-gray-50 text-gray-500 border border-gray-100'
                                          }`}>
                                          <Info size={11} className="shrink-0" />
                                          <span>{STATUS_ENTREGA[editForm.status]?.hint}</span>
                                        </div>
                                      </div>
                                      {/* Participantes da atividade */}
                                      {(aPerms.canFull || aPerms.canEditLimited) && (
                                        <div>
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-medium text-gray-500">Participantes</span>
                                            <button type="button" onClick={() => {
                                              if (!editForm.entrega_participantes?.length) { alert('Adicione participantes na entrega primeiro.'); return }
                                              setEditForm((prev: any) => ({
                                                ...prev, participantes: [...prev.participantes, { user_id: null, setor_id: null, tipo_participante: 'usuario', papel: '' }]
                                              }))
                                            }} className="text-[10px] text-orange-500 font-medium">+ Participante</button>
                                          </div>
                                          {editForm.participantes?.map((p: any, i: number) =>
                                            renderAtividadeParticipanteEditRow(p, i, editForm.participantes, editForm.entrega_participantes || [],
                                              (idx, f, v) => setEditForm((prev: any) => ({
                                                ...prev, participantes: prev.participantes.map((pp: any, j: number) => j === idx ? { ...pp, [f]: v } : pp)
                                              })),
                                              (idx) => {
                                                if (confirm('Remover participante?')) setEditForm((prev: any) => ({
                                                  ...prev, participantes: prev.participantes.filter((_: any, j: number) => j !== idx)
                                                }))
                                              }
                                            )
                                          )}
                                        </div>
                                      )}
                                      <ResultadosSection
                                        owner={a.id > 0 ? { kind: 'atividade', atividadeId: a.id } : null}
                                        descricao={editForm.resultado_descricao || ''}
                                        onDescricaoChange={v => setEditForm({ ...editForm, resultado_descricao: v })}
                                        arquivoPath={editForm.resultado_arquivo_path || null}
                                        arquivoNome={editForm.resultado_arquivo_nome || null}
                                        arquivoTamanho={editForm.resultado_arquivo_tamanho || null}
                                        onArquivoChange={meta => setEditForm({
                                          ...editForm,
                                          resultado_arquivo_path: meta?.path || null,
                                          resultado_arquivo_nome: meta?.nome || null,
                                          resultado_arquivo_tamanho: meta?.tamanho || null,
                                        })}
                                        disabled={!(aPerms.canFull || aPerms.canEditLimited)}
                                        uploadDisabled={editForm._isNew}
                                        uploadDisabledMessage={editForm._isNew ? 'Salve a atividade para anexar o PDF comprobatório.' : undefined}
                                        compact
                                      />
                                      <div className="flex gap-2 mt-4">
                                        <button onClick={() => saveEditAtividade(a.id, e.id)} disabled={saving}
                                          className="flex items-center gap-1 text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg"><Save size={13} /> Salvar</button>
                                        <button onClick={() => setEditingAtividade(null)}
                                          className="flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5"><X size={13} /> Cancelar</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-5 h-5 rounded flex items-center justify-center bg-gray-100 text-gray-500 text-xs font-bold border border-gray-200 shrink-0 mt-0.5">{ativIndex + 1}</div>
                                          <h4 className="text-sm font-semibold text-gray-800">{a.nome}</h4>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          {(aPerms.canFull || aPerms.canEditLimited || aPerms.canEditDatas) && <button onClick={() => startEditAtividade(a, e)} className="text-gray-400 hover:text-orange-500 transition-colors p-1"><Edit3 size={14} /></button>}
                                          {aPerms.canFull && <button onClick={() => deleteAtividade(a, e)} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 size={14} /></button>}
                                        </div>
                                      </div>
                                      <p className="text-xs text-gray-600 mb-3 pl-7">{a.descricao}</p>
                                      {a.responsavel_atividade_id && (
                                        <div className="text-xs pl-7 mb-2">
                                          <span className="text-gray-500 font-medium">Responsável: </span>
                                          <span className="text-gray-600">{eligibleUsers.find(u => u.id === a.responsavel_atividade_id)?.nome || '—'}</span>
                                        </div>
                                      )}

                                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 pl-7 text-xs border-t border-gray-50 pt-3">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-gray-500 font-medium">Status:</span>
                                          <span className={`px-2 py-0.5 rounded-full font-medium ${(STATUS_ENTREGA[a.status] || STATUS_ENTREGA.aberta).bg} ${(STATUS_ENTREGA[a.status] || STATUS_ENTREGA.aberta).color}`}>
                                            {(STATUS_ENTREGA[a.status] || STATUS_ENTREGA.aberta).label}
                                          </span>
                                        </div>

                                        {a.data_prevista && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-gray-500 font-medium whitespace-nowrap"><Clock size={12} className="inline mr-0.5 mb-0.5" /> Prazo:</span>
                                            <span className="text-gray-700">{formatDateBR(a.data_prevista)}</span>
                                          </div>
                                        )}

                                        {a.motivo_status && (
                                          <div className="flex items-center gap-1.5 w-full mt-1">
                                            <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Motivo do status:</span>
                                            <span className="text-gray-700 italic">{a.motivo_status}</span>
                                          </div>
                                        )}
                                      </div>

                                      {(a.resultado_descricao || a.resultado_arquivo_path) && (
                                        <div className="mt-3 ml-7 rounded-lg border-2 border-emerald-200 bg-emerald-50/60 p-3">
                                          <div className="flex items-center gap-1.5 mb-1">
                                            <Sparkles className="text-emerald-600" size={13} />
                                            <span className="text-xs font-bold text-emerald-900">Resultados e Produtos</span>
                                          </div>
                                          {a.resultado_descricao && (
                                            <p className="text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed">{a.resultado_descricao}</p>
                                          )}
                                          {a.resultado_arquivo_path && (
                                            <a
                                              href={`/api/resultados/download?path=${encodeURIComponent(a.resultado_arquivo_path)}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-200 px-2 py-0.5 rounded"
                                            >
                                              <FileText size={11} /> {a.resultado_arquivo_nome || 'Baixar PDF'}
                                            </a>
                                          )}
                                        </div>
                                      )}

                                      {/* Participantes da Atividade */}
                                      {a.atividade_participantes?.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3 pl-7">
                                          {a.atividade_participantes.map((p: any) => (
                                            <span key={p.id} className="text-[11px] bg-gray-100 border border-gray-200 text-gray-700 px-2 py-1 rounded shadow-sm">
                                              <span className="font-semibold">{participanteLabel(p)}</span>{p.tipo_participante === 'usuario' && p.setor && <span className="text-gray-400 text-[9px] ml-0.5">({p.setor.codigo})</span>}: {p.papel}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}

                          {/* Formulário de nova atividade */}
                          {editingAtividade === -e.id && (
                            <div className="mt-3">
                              <div className="rounded-xl p-4 bg-blue-50 border border-blue-300 ring-2 ring-blue-100 shadow-md">
                                <div className="space-y-3">
                                  <p className="text-sm font-bold text-blue-800 mb-2">Nova atividade</p>
                                  <div>
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Nome</label>
                                    <input type="text" value={editForm.nome} onChange={ev => setEditForm({ ...editForm, nome: ev.target.value })}
                                      className="input-field text-xs" placeholder="Nome da atividade" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Descrição</label>
                                    <input type="text" value={editForm.descricao} onChange={ev => setEditForm({ ...editForm, descricao: ev.target.value })}
                                      className="input-field text-xs" placeholder="Descreva esta atividade" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Responsável pela atividade</label>
                                    <UserAutocompleteSelect
                                      value={editForm.responsavel_atividade_id}
                                      onChange={val => setEditForm({ ...editForm, responsavel_atividade_id: val })}
                                      users={(() => {
                                        if (!isAdminOrMaster) return eligibleUsers.filter(u => u.role !== 'usuario' && (u.id === editForm.responsavel_atividade_id || u.setor_id === profile?.setor_id))
                                        const entregaSetorIds = new Set((editForm.entrega_participantes || []).filter((ep: any) => ep.tipo_participante === 'setor' && ep.setor_id).map((ep: any) => ep.setor_id))
                                        return eligibleUsers.filter(u => u.role !== 'usuario' && (u.id === editForm.responsavel_atividade_id || (u.setor_id && entregaSetorIds.has(u.setor_id))))
                                      })()}
                                      placeholder="Selecione o responsável..."
                                      onRegisterNew={() => setShowGestorModal(['gestor'])}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-end gap-2">
                                      <div className="w-[140px]">
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Status</label>
                                        <select value={editForm.status} onChange={ev => setEditForm({ ...editForm, status: ev.target.value })}
                                          className={`w-full px-2 py-1.5 rounded-lg text-xs font-medium border-2 focus:outline-none focus:ring-2 focus:ring-sedec-500 ${editForm.status === 'resolvida' ? 'border-green-400 bg-green-50 text-green-800' :
                                            editForm.status === 'em_andamento' ? 'border-blue-300 bg-blue-50 text-blue-800' :
                                              editForm.status === 'aguardando' ? 'border-yellow-300 bg-yellow-50 text-yellow-800' :
                                                'border-gray-300 bg-white text-gray-700'
                                            }`}>
                                          {Object.entries(STATUS_ENTREGA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                                        </select>
                                      </div>
                                      <div className="w-[140px]">
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Data prevista <span className="text-gray-400 font-normal">(prazo para conclusão)</span></label>
                                        <input type="date" value={editForm.data_prevista || ''}
                                          max={editForm.entrega_data_final || undefined}
                                          onChange={ev => {
                                            const nd = ev.target.value
                                            if (nd && editForm.entrega_data_final && nd > editForm.entrega_data_final) {
                                              alert(`A data não pode ser posterior à quinzena da entrega (${editForm.entrega_data_final}).`)
                                              return
                                            }
                                            setEditForm({ ...editForm, data_prevista: nd })
                                          }}
                                          className="w-full input-field text-xs" />
                                      </div>
                                      <div className="flex-1 min-w-[140px]">
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide block mb-0.5">Motivo</label>
                                        <input type="text" value={editForm.motivo_status || ''} onChange={ev => setEditForm({ ...editForm, motivo_status: ev.target.value })}
                                          placeholder="Opcional" className="input-field text-xs" />
                                      </div>
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] ${editForm.status === 'aguardando' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                      editForm.status === 'em_andamento' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                        editForm.status === 'resolvida' ? 'bg-green-50 text-green-600 border border-green-100' :
                                          editForm.status === 'cancelada' ? 'bg-red-50 text-red-500 border border-red-100' :
                                            'bg-gray-50 text-gray-500 border border-gray-100'
                                      }`}>
                                      <Info size={11} className="shrink-0" />
                                      <span>{STATUS_ENTREGA[editForm.status]?.hint}</span>
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-medium text-gray-500">Participantes</span>
                                      <button type="button" onClick={() => {
                                        if (!editForm.entrega_participantes?.length) { alert('Adicione participantes na entrega primeiro.'); return }
                                        setEditForm((prev: any) => ({
                                          ...prev, participantes: [...prev.participantes, { user_id: null, setor_id: null, tipo_participante: 'usuario', papel: '' }]
                                        }))
                                      }} className="text-[10px] text-orange-500 font-medium">+ Participante</button>
                                    </div>
                                    {editForm.participantes?.map((p: any, i: number) =>
                                      renderAtividadeParticipanteEditRow(p, i, editForm.participantes, editForm.entrega_participantes || [],
                                        (idx, f, v) => setEditForm((prev: any) => ({
                                          ...prev, participantes: prev.participantes.map((pp: any, j: number) => j === idx ? { ...pp, [f]: v } : pp)
                                        })),
                                        (idx) => {
                                          if (confirm('Remover participante?')) setEditForm((prev: any) => ({
                                            ...prev, participantes: prev.participantes.filter((_: any, j: number) => j !== idx)
                                          }))
                                        }
                                      )
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => saveEditAtividade(-e.id, e.id)} disabled={saving}
                                      className="flex items-center gap-1 text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg"><Save size={13} /> Salvar</button>
                                    <button onClick={() => setEditingAtividade(null)}
                                      className="flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5"><X size={13} /> Cancelar</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Solicitações pendentes do gestor */}
      {!isAdminOrMaster && isGestor && configs['proj_exigir_aprovacao_edicao'] === 'true' && solicitacoes.filter(s => s.status === 'em_analise').length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-700 mb-3">Suas solicitações pendentes</h2>
          <div className="space-y-2">
            {solicitacoes.filter(s => s.status === 'em_analise').map((s: any) => (
              <div key={s.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-amber-800">
                    {s.tipo_operacao === 'edicao' ? 'Edição' : 'Exclusão'} de {s.tipo_entidade}
                  </span>
                  <span className="text-xs text-gray-600 ml-2">"{s.entidade_nome}"</span>
                  <span className="text-[10px] text-gray-400 ml-2">
                    {new Date(s.created_at).toLocaleDateString('pt-BR')} {new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button onClick={() => cancelarSolicitacao(s.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1">
                  <X size={12} /> Cancelar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solicitações resolvidas (para referência) */}
      {!isAdminOrMaster && isGestor && configs['proj_exigir_aprovacao_edicao'] === 'true' && solicitacoes.filter(s => s.status !== 'em_analise').length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-2">Histórico de solicitações</h3>
          <div className="space-y-1">
            {solicitacoes.filter(s => s.status !== 'em_analise').slice(0, 10).map((s: any) => (
              <div key={s.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2 flex items-center gap-3 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-medium ${s.status === 'deferida' ? 'bg-green-100 text-green-700' :
                  s.status === 'indeferida' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                  {s.status === 'deferida' ? 'Aprovada' : s.status === 'indeferida' ? 'Recusada' : 'Cancelada'}
                </span>
                <span className="text-gray-600">
                  {s.tipo_operacao === 'edicao' ? 'Edição' : 'Exclusão'} de {s.tipo_entidade}: "{s.entidade_nome}"
                </span>
                {s.justificativa_avaliador && (
                  <span className="text-gray-400 italic">— {s.justificativa_avaliador}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

// ============================================================
// GANTT CHART (lightweight, no deps)
// ============================================================

function GanttChart({ entregas, dataInicio }: { entregas: any[]; dataInicio?: string | null }) {
  const withDate = entregas.filter((e: any) => e.data_final_prevista)
  if (withDate.length === 0) return null

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const DAY = 1000 * 60 * 60 * 24

  const fmtShort = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}`
  }

  // Data de início de cada entrega:
  // - Se houver atividades com data: atividade mais cedo
  // - Se não houver atividades mas houver data de início do projeto: data de início do projeto
  // - Senão: hoje
  const getStart = (e: any) => {
    if (e.data_inicio) {
      return new Date(e.data_inicio + 'T00:00:00')
    }
    const ativDates = (e.atividades || [])
      .filter((a: any) => a.data_prevista)
      .map((a: any) => new Date(a.data_prevista + 'T00:00:00').getTime())
    if (ativDates.length > 0) {
      return new Date(Math.min(...ativDates))
    }
    if (dataInicio) {
      return new Date(dataInicio + 'T00:00:00')
    }
    return new Date(now.getTime())
  }

  // Calcular range global com margem
  const allStarts = withDate.map(e => getStart(e).getTime())
  const allEnds = withDate.map((e: any) => new Date(e.data_final_prevista + 'T00:00:00').getTime())
  const rangeMin = new Date(Math.min(...allStarts, ...allEnds, now.getTime()))
  const rangeMax = new Date(Math.max(...allStarts, ...allEnds, now.getTime()))
  // Margem de 7 dias antes e depois
  const minDate = new Date(rangeMin.getTime() - 7 * DAY)
  const maxDate = new Date(rangeMax.getTime() + 14 * DAY)
  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / DAY)
  const toPos = (d: Date) => ((d.getTime() - minDate.getTime()) / DAY) / totalDays * 100

  // Meses para grid
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const months: { label: string; pos: number }[] = []
  const cur = new Date(minDate.getFullYear(), minDate.getMonth() + 1, 1)
  while (cur <= maxDate) {
    months.push({ label: `${meses[cur.getMonth()]}/${String(cur.getFullYear()).slice(-2)}`, pos: toPos(cur) })
    cur.setMonth(cur.getMonth() + 1)
  }

  const todayPos = toPos(now)
  const rowH = 32

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        <div className="relative" style={{ height: `${withDate.length * rowH + 24}px` }}>

          {/* Grid vertical — divisórias de mês */}
          {months.map((m, i) => (
            <div key={i} className="absolute top-0 bottom-0" style={{ left: `${m.pos}%` }}>
              <div className="w-px h-full bg-gray-200" />
              <span className="absolute -top-0.5 translate-x-1 text-[9px] text-gray-400 font-medium whitespace-nowrap">{m.label}</span>
            </div>
          ))}

          {/* Linha "hoje" */}
          <div className="absolute top-0 bottom-0 z-20" style={{ left: `${todayPos}%` }}>
            <div className="w-0.5 h-full bg-orange-400 opacity-70" />
            <span className="absolute -top-0.5 -translate-x-1/2 text-[9px] text-orange-500 font-bold">hoje</span>
          </div>

          {/* Barras */}
          {withDate.map((e: any, i: number) => {
            const startDate = getStart(e)
            const endDate = new Date(e.data_final_prevista + 'T00:00:00')
            const isAtrasada = e.status !== 'resolvida' && e.status !== 'cancelada' && endDate < now
            const isResolvida = e.status === 'resolvida'

            const left = toPos(startDate)
            const right = toPos(endDate)
            const width = Math.max(1.5, right - left)

            const color = isResolvida ? 'bg-green-400' : isAtrasada ? 'bg-red-400' : 'bg-blue-400'
            const textColor = isAtrasada ? 'text-red-700' : 'text-gray-600'
            const top = 20 + i * rowH

            return (
              <div key={e.id} className="absolute flex items-center" style={{ top: `${top}px`, left: 0, right: 0, height: `${rowH - 4}px` }}>
                {/* Barra */}
                <div className={`absolute h-5 rounded ${color} opacity-80`}
                  style={{ left: `${left}%`, width: `${width}%` }}>
                  {/* Rótulo de início dentro/ao lado esquerdo da barra */}
                  <span className="absolute -top-3.5 left-0 text-[8px] text-gray-500 whitespace-nowrap">
                    {fmtShort(startDate)}
                  </span>
                  {/* Rótulo de fim dentro/ao lado direito da barra */}
                  <span className={`absolute -top-3.5 right-0 text-[8px] font-medium whitespace-nowrap ${textColor}`}>
                    {fmtShort(endDate)}
                  </span>
                  {/* Nome da entrega dentro da barra */}
                  <span className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium text-white truncate drop-shadow-sm">
                    {e.nome}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function formatQ(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const m = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return `${m}/${d.getFullYear().toString().slice(-2)} – ${d.getDate() <= 15 ? '1ª' : '2ª'}q`
}
