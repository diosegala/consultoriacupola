// Tipos customizados para o sistema Cupola

export type StatusCliente = 'novo' | 'ativo' | 'aguardando_renovacao' | 'encerrado';
export type TipoVencimento = 'antecipado' | 'postecipado';
export type EtapaOnboarding = 'pre_onboarding' | 'imersao_1' | 'imersao_2' | 'imersao_3' | 'concluido';
export type PeriodicidadeAtendimento = 'semanal' | 'quinzenal' | 'mensal';
export type ClassificacaoEncerramento = 'churn' | 'fim_contrato';

export interface Consultor {
  id: string;
  nome: string;
  email: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface TipoConsultoria {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export interface CRM {
  id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export interface Cliente {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  consultor_id: string | null;
  status: StatusCliente;
  pipedrive_deal_id: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  consultor?: Consultor;
  contrato_ativo?: Contrato;
}

export interface Contrato {
  id: string;
  cliente_id: string;
  tipo_consultoria_id: string | null;
  prazo_meses: number;
  data_inicio: string;
  data_fim: string;
  remuneracao_total: number;
  parcelas: number;
  tipo_vencimento: TipoVencimento;
  remuneracao_mensal: number;
  momento: string | null;
  link_contrato: string | null;
  particularidades: string | null;
  ativo: boolean;
  created_at: string;
  // Joins
  tipo_consultoria?: TipoConsultoria;
}

export interface Onboarding {
  id: string;
  cliente_id: string;
  contrato_id: string | null;
  data_pre_onboarding: string | null;
  data_imersao_1_inicio: string | null;
  data_imersao_1_fim: string | null;
  data_imersao_2: string | null;
  data_imersao_3: string | null;
  etapa_atual: EtapaOnboarding;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Atendimento {
  id: string;
  cliente_id: string;
  periodicidade: PeriodicidadeAtendimento;
  ultima_reuniao: string | null;
  proxima_reuniao: string | null;
  link_controle: string | null;
  cliente_oculto_ultima: string | null;
  cliente_oculto_proxima: string | null;
  trimestre_okrs: string | null;
  created_at: string;
  updated_at: string;
}

export interface FerramentasCliente {
  id: string;
  cliente_id: string;
  crm_id: string | null;
  link_dashboard_marketing: string | null;
  tem_conectalead: boolean;
  link_investimento_digital: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  crm?: CRM;
}

export interface Encerramento {
  id: string;
  cliente_id: string;
  contrato_id: string;
  data_encerramento: string;
  classificacao: ClassificacaoEncerramento;
  justificativa: string | null;
  mrr_perdido: number;
  clientes_ativos_momento: number | null;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  payload: Record<string, unknown>;
  processado: boolean;
  erro: string | null;
  cliente_id: string | null;
  created_at: string;
}

// Tipos para o Dashboard
export interface DashboardKPIs {
  clientesAtivos: number;
  mrrTotal: number;
  aguardandoRenovacao: number;
  churnMes: number;
}

export interface MRRHistorico {
  mes: string;
  mrr: number;
}

export interface Alerta {
  tipo: 'contrato_vencendo' | 'reuniao_atrasada' | 'onboarding_pendente';
  cliente_id: string;
  cliente_nome: string;
  detalhe: string;
}

// Cliente com dados completos para listagem
export interface ClienteComDetalhes extends Cliente {
  contrato_ativo?: Contrato & { tipo_consultoria?: TipoConsultoria };
  consultor?: Consultor;
}
