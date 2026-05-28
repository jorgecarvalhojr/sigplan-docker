export interface Profile {
  id: string
  email: string
  nome: string
  setor_id: number | null
  role: 'admin' | 'master' | 'gestor' | 'usuario' | 'solicitante'
  ativo: boolean
  senha_zerada?: boolean
}

export interface AcaoEstrategica {
  id: number
  numero: string
  nome: string
  descricao_o_que: string
  descricao_para_que: string
  descricao_oficial_completa: string
  ancoragem: string
  nota_arranjo_institucional: string | null
  acoes_conectadas: string
  eixo_prioritario: { id: number; codigo: string; nome: string } | null
  objetivo_estrategico: { id: number; codigo: string; nome: string } | null
  estrategia: { id: number; codigo: string; nome: string } | null
}

export interface DestaqueEstrategico {
  id: number
  titulo: string
  header_contexto: string
  linhas: DestaqueLinha[]
}

export interface DestaqueLinha {
  id: number
  ordem: number
  tipo: 'label_conteudo' | 'header'
  label: string | null
  conteudo: string
}

export interface PanoramicoLinha {
  id: number
  ordem: number
  setor_display: string
  papel: string
  sintese_contribuicao: string
  nao_faz: string
}

export interface Ficha {
  id: number
  ordem: number
  titulo: string
  setor_display: string
  papel: string
  justificativa: string
  contribuicao_esperada: string[]
  nao_escopo: string[]
  dependencias_criticas: string[]
}

export interface Fundamentacao {
  id: number
  introducao: string
  conclusao: string
  itens: { id: number; ordem: number; conteudo: string }[]
}

export interface Observacao {
  id: number
  acao_estrategica_id: number
  bloco: string
  conteudo: string
  autor_nome: string
  autor_setor: string | null
  status: 'em_analise' | 'absorvida' | 'indeferida'
  resposta_admin: string | null
  respondido_por: string | null
  respondido_em: string | null
  created_at: string
}

export interface AcaoCard {
  id: number
  numero: string
  nome: string
  eixo_nome: string
  oe_nome: string
  estrategia_nome: string
  setores: string[]
}

export interface Projeto {
  id: number
  nome: string
  descricao: string
  problema_resolve: string
  causas: string
  consequencias_diretas: string
  objetivos: string
  responsavel_id: string | null
  data_inicio: string | null
  indicador_sucesso: string | null
  tipo_acao: string[] | null
  setor_lider_id: number
  criado_por: string
  created_at: string
  recorrente: boolean
  prioridade?: 'alta' | 'media' | 'baixa' | null
  impacto?: 'alto' | 'medio' | 'baixo' | null
  condicao_execucao?: 'livre' | 'condicionada' | null
  regime_acompanhamento?: 'intensivo' | 'regular' | null
  observacao_relatorio?: string | null
}

export interface Entrega {
  id: number
  projeto_id: number
  nome: string
  descricao: string
  criterios_aceite: string | null
  dependencias_criticas: string | null
  data_final_prevista: string | null
  status: 'aberta' | 'em_andamento' | 'aguardando' | 'resolvida' | 'cancelada'
  motivo_status: string | null
  orgao_responsavel_setor_id: number | null
  responsavel_entrega_id: string | null
  resultado_descricao?: string | null
  resultado_arquivo_path?: string | null
  resultado_arquivo_nome?: string | null
  resultado_arquivo_tamanho?: number | null
  resultado_arquivo_enviado_em?: string | null
  prioridade?: 'alta' | 'media' | 'baixa' | null
  observacao_relatorio?: string | null
}

export interface Atividade {
  id: number
  entrega_id: number
  nome: string
  descricao: string
  responsavel_atividade_id: string | null
  resultado_descricao?: string | null
  resultado_arquivo_path?: string | null
  resultado_arquivo_nome?: string | null
  resultado_arquivo_tamanho?: number | null
  resultado_arquivo_enviado_em?: string | null
}

export interface AtividadeParticipante {
  id?: number
  user_id: string | null
  setor_id: number | null
  tipo_participante: 'usuario' | 'setor' | 'externo_subsegop' | 'externo_sedec'
  papel: string
}

export interface SolicitacaoAlteracao {
  id: number
  solicitante_id: string
  solicitante_nome: string
  tipo_entidade: 'projeto' | 'entrega' | 'atividade'
  entidade_id: number
  entidade_nome: string
  projeto_id: number
  tipo_operacao: 'edicao' | 'exclusao'
  dados_alteracao: any
  status: 'em_analise' | 'deferida' | 'indeferida' | 'cancelada'
  avaliador_id: string | null
  avaliador_nome: string | null
  justificativa_avaliador: string | null
  avaliado_em: string | null
  created_at: string
}

export interface Indicador {
  id?: number
  projeto_id?: number
  nome: string
  formula: string
  fonte_dados: string
  periodicidade: string
  unidade_medida: string
  responsavel: string
  meta: string
}

export interface Risco {
  id?: number
  projeto_id?: number
  natureza: string
  probabilidade: string
  impacto?: string
  medida_resposta: string
}

export interface MensagemProjeto {
  id: number
  projeto_id: number
  autor_id: string
  conteudo: string
  created_at: string
  autor_nome?: string
  autor_setor_codigo?: string
  autor_setor_id?: number
  destinatarios?: { setor_id: number; codigo: string; nome_completo: string }[]
  lida_por_mim?: boolean
}

export interface AuditLogEntry {
  id: number
  usuario_id: string
  usuario_nome: string
  tipo_acao: 'create' | 'update' | 'delete'
  entidade: string
  entidade_id: number
  conteudo_anterior: any
  conteudo_novo: any
  created_at: string
}
