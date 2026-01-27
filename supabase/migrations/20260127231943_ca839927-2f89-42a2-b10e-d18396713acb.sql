-- Criar ENUMs
CREATE TYPE public.status_cliente AS ENUM ('novo', 'ativo', 'aguardando_renovacao', 'encerrado');
CREATE TYPE public.tipo_vencimento AS ENUM ('antecipado', 'postecipado');
CREATE TYPE public.etapa_onboarding AS ENUM ('pre_onboarding', 'imersao_1', 'imersao_2', 'imersao_3', 'concluido');
CREATE TYPE public.periodicidade_atendimento AS ENUM ('semanal', 'quinzenal', 'mensal');
CREATE TYPE public.classificacao_encerramento AS ENUM ('churn', 'fim_contrato');

-- Tabela: consultores
CREATE TABLE public.consultores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: tipos_consultoria
CREATE TABLE public.tipos_consultoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: crms
CREATE TABLE public.crms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cidade VARCHAR(100) NOT NULL,
  uf VARCHAR(2) NOT NULL,
  consultor_id UUID REFERENCES public.consultores(id),
  status public.status_cliente NOT NULL DEFAULT 'novo',
  pipedrive_deal_id VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: contratos
CREATE TABLE public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_consultoria_id UUID REFERENCES public.tipos_consultoria(id),
  prazo_meses INTEGER NOT NULL CHECK (prazo_meses >= 1),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  remuneracao_total DECIMAL(12,2) NOT NULL,
  parcelas INTEGER NOT NULL CHECK (parcelas >= 1),
  tipo_vencimento public.tipo_vencimento NOT NULL DEFAULT 'postecipado',
  remuneracao_mensal DECIMAL(12,2) NOT NULL,
  momento VARCHAR(50),
  link_contrato TEXT,
  particularidades TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT data_fim_maior_inicio CHECK (data_fim >= data_inicio)
);

-- Tabela: onboarding
CREATE TABLE public.onboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE CASCADE,
  data_pre_onboarding DATE,
  data_imersao_1_inicio DATE,
  data_imersao_1_fim DATE,
  data_imersao_2 DATE,
  data_imersao_3 DATE,
  etapa_atual public.etapa_onboarding NOT NULL DEFAULT 'pre_onboarding',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: atendimentos
CREATE TABLE public.atendimentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  periodicidade public.periodicidade_atendimento NOT NULL DEFAULT 'quinzenal',
  ultima_reuniao DATE,
  proxima_reuniao DATE,
  link_controle TEXT,
  cliente_oculto_ultima DATE,
  cliente_oculto_proxima DATE,
  trimestre_okrs VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: ferramentas_cliente
CREATE TABLE public.ferramentas_cliente (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  crm_id UUID REFERENCES public.crms(id),
  link_dashboard_marketing TEXT,
  tem_conectalead BOOLEAN DEFAULT false,
  link_investimento_digital TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: encerramentos
CREATE TABLE public.encerramentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id),
  data_encerramento DATE NOT NULL,
  classificacao public.classificacao_encerramento NOT NULL,
  justificativa TEXT,
  mrr_perdido DECIMAL(12,2) NOT NULL,
  clientes_ativos_momento INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela: webhook_logs
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payload JSONB NOT NULL,
  processado BOOLEAN NOT NULL DEFAULT false,
  erro TEXT,
  cliente_id UUID REFERENCES public.clientes(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX idx_clientes_status ON public.clientes(status);
CREATE INDEX idx_clientes_consultor ON public.clientes(consultor_id);
CREATE INDEX idx_contratos_cliente ON public.contratos(cliente_id);
CREATE INDEX idx_contratos_ativo ON public.contratos(ativo);
CREATE INDEX idx_contratos_data_fim ON public.contratos(data_fim);
CREATE INDEX idx_onboarding_cliente ON public.onboarding(cliente_id);
CREATE INDEX idx_atendimentos_cliente ON public.atendimentos(cliente_id);
CREATE INDEX idx_encerramentos_data ON public.encerramentos(data_encerramento);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_consultores_updated_at BEFORE UPDATE ON public.consultores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_onboarding_updated_at BEFORE UPDATE ON public.onboarding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_atendimentos_updated_at BEFORE UPDATE ON public.atendimentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ferramentas_cliente_updated_at BEFORE UPDATE ON public.ferramentas_cliente FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.consultores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_consultoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ferramentas_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encerramentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Usuários autenticados podem ver e editar tudo (diretores)
CREATE POLICY "Authenticated users can view consultores" ON public.consultores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert consultores" ON public.consultores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update consultores" ON public.consultores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete consultores" ON public.consultores FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view tipos_consultoria" ON public.tipos_consultoria FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tipos_consultoria" ON public.tipos_consultoria FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tipos_consultoria" ON public.tipos_consultoria FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete tipos_consultoria" ON public.tipos_consultoria FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view crms" ON public.crms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert crms" ON public.crms FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update crms" ON public.crms FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete crms" ON public.crms FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clientes" ON public.clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete clientes" ON public.clientes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view contratos" ON public.contratos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert contratos" ON public.contratos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update contratos" ON public.contratos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete contratos" ON public.contratos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view onboarding" ON public.onboarding FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert onboarding" ON public.onboarding FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update onboarding" ON public.onboarding FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete onboarding" ON public.onboarding FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view atendimentos" ON public.atendimentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert atendimentos" ON public.atendimentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update atendimentos" ON public.atendimentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete atendimentos" ON public.atendimentos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view ferramentas_cliente" ON public.ferramentas_cliente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert ferramentas_cliente" ON public.ferramentas_cliente FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update ferramentas_cliente" ON public.ferramentas_cliente FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete ferramentas_cliente" ON public.ferramentas_cliente FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view encerramentos" ON public.encerramentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert encerramentos" ON public.encerramentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update encerramentos" ON public.encerramentos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete encerramentos" ON public.encerramentos FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view webhook_logs" ON public.webhook_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert webhook_logs" ON public.webhook_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Service role can insert webhook_logs" ON public.webhook_logs FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update webhook_logs" ON public.webhook_logs FOR UPDATE TO service_role USING (true);

-- Política para webhook inserir clientes (service_role)
CREATE POLICY "Service role can insert clientes" ON public.clientes FOR INSERT TO service_role WITH CHECK (true);