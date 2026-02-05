-- ===========================================
-- SECURITY FIX: Sistema de Roles e RLS Restritivo
-- ===========================================

-- 1. Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'director');

-- 2. Criar tabela de roles (seguindo padrão recomendado)
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

-- 3. Habilitar RLS na tabela de roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Criar função SECURITY DEFINER para verificar roles (evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Criar função para verificar se usuário tem algum role válido
CREATE OR REPLACE FUNCTION public.is_authorized_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- 6. Políticas para user_roles (apenas admins podem gerenciar)
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ===========================================
-- ATUALIZAR RLS DE TODAS AS TABELAS
-- ===========================================

-- CONSULTORES
DROP POLICY IF EXISTS "Authenticated users can view consultores" ON public.consultores;
DROP POLICY IF EXISTS "Authenticated users can insert consultores" ON public.consultores;
DROP POLICY IF EXISTS "Authenticated users can update consultores" ON public.consultores;
DROP POLICY IF EXISTS "Authenticated users can delete consultores" ON public.consultores;

CREATE POLICY "Authorized users can view consultores"
  ON public.consultores FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert consultores"
  ON public.consultores FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update consultores"
  ON public.consultores FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete consultores"
  ON public.consultores FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

-- CLIENTES
DROP POLICY IF EXISTS "Authenticated users can view clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can insert clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can update clientes" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can delete clientes" ON public.clientes;
DROP POLICY IF EXISTS "Service role can insert clientes" ON public.clientes;

CREATE POLICY "Authorized users can view clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert clientes"
  ON public.clientes FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update clientes"
  ON public.clientes FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete clientes"
  ON public.clientes FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

-- CONTRATOS
DROP POLICY IF EXISTS "Authenticated users can view contratos" ON public.contratos;
DROP POLICY IF EXISTS "Authenticated users can insert contratos" ON public.contratos;
DROP POLICY IF EXISTS "Authenticated users can update contratos" ON public.contratos;
DROP POLICY IF EXISTS "Authenticated users can delete contratos" ON public.contratos;

CREATE POLICY "Authorized users can view contratos"
  ON public.contratos FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert contratos"
  ON public.contratos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update contratos"
  ON public.contratos FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete contratos"
  ON public.contratos FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

-- ATENDIMENTOS
DROP POLICY IF EXISTS "Authenticated users can view atendimentos" ON public.atendimentos;
DROP POLICY IF EXISTS "Authenticated users can insert atendimentos" ON public.atendimentos;
DROP POLICY IF EXISTS "Authenticated users can update atendimentos" ON public.atendimentos;
DROP POLICY IF EXISTS "Authenticated users can delete atendimentos" ON public.atendimentos;

CREATE POLICY "Authorized users can view atendimentos"
  ON public.atendimentos FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert atendimentos"
  ON public.atendimentos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update atendimentos"
  ON public.atendimentos FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete atendimentos"
  ON public.atendimentos FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

-- ONBOARDING
DROP POLICY IF EXISTS "Authenticated users can view onboarding" ON public.onboarding;
DROP POLICY IF EXISTS "Authenticated users can insert onboarding" ON public.onboarding;
DROP POLICY IF EXISTS "Authenticated users can update onboarding" ON public.onboarding;
DROP POLICY IF EXISTS "Authenticated users can delete onboarding" ON public.onboarding;

CREATE POLICY "Authorized users can view onboarding"
  ON public.onboarding FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert onboarding"
  ON public.onboarding FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update onboarding"
  ON public.onboarding FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete onboarding"
  ON public.onboarding FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

-- FERRAMENTAS_CLIENTE
DROP POLICY IF EXISTS "Authenticated users can view ferramentas_cliente" ON public.ferramentas_cliente;
DROP POLICY IF EXISTS "Authenticated users can insert ferramentas_cliente" ON public.ferramentas_cliente;
DROP POLICY IF EXISTS "Authenticated users can update ferramentas_cliente" ON public.ferramentas_cliente;
DROP POLICY IF EXISTS "Authenticated users can delete ferramentas_cliente" ON public.ferramentas_cliente;

CREATE POLICY "Authorized users can view ferramentas_cliente"
  ON public.ferramentas_cliente FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert ferramentas_cliente"
  ON public.ferramentas_cliente FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update ferramentas_cliente"
  ON public.ferramentas_cliente FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete ferramentas_cliente"
  ON public.ferramentas_cliente FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

-- ENCERRAMENTOS
DROP POLICY IF EXISTS "Authenticated users can view encerramentos" ON public.encerramentos;
DROP POLICY IF EXISTS "Authenticated users can insert encerramentos" ON public.encerramentos;
DROP POLICY IF EXISTS "Authenticated users can update encerramentos" ON public.encerramentos;
DROP POLICY IF EXISTS "Authenticated users can delete encerramentos" ON public.encerramentos;

CREATE POLICY "Authorized users can view encerramentos"
  ON public.encerramentos FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert encerramentos"
  ON public.encerramentos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update encerramentos"
  ON public.encerramentos FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete encerramentos"
  ON public.encerramentos FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

-- PAUSAS_CONTRATO
DROP POLICY IF EXISTS "Authenticated users can view pausas_contrato" ON public.pausas_contrato;
DROP POLICY IF EXISTS "Authenticated users can insert pausas_contrato" ON public.pausas_contrato;
DROP POLICY IF EXISTS "Authenticated users can update pausas_contrato" ON public.pausas_contrato;
DROP POLICY IF EXISTS "Authenticated users can delete pausas_contrato" ON public.pausas_contrato;

CREATE POLICY "Authorized users can view pausas_contrato"
  ON public.pausas_contrato FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert pausas_contrato"
  ON public.pausas_contrato FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update pausas_contrato"
  ON public.pausas_contrato FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete pausas_contrato"
  ON public.pausas_contrato FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

-- VIAGENS_CONTRATO
DROP POLICY IF EXISTS "Authenticated users can view viagens_contrato" ON public.viagens_contrato;
DROP POLICY IF EXISTS "Authenticated users can insert viagens_contrato" ON public.viagens_contrato;
DROP POLICY IF EXISTS "Authenticated users can update viagens_contrato" ON public.viagens_contrato;
DROP POLICY IF EXISTS "Authenticated users can delete viagens_contrato" ON public.viagens_contrato;

CREATE POLICY "Authorized users can view viagens_contrato"
  ON public.viagens_contrato FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert viagens_contrato"
  ON public.viagens_contrato FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update viagens_contrato"
  ON public.viagens_contrato FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete viagens_contrato"
  ON public.viagens_contrato FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

-- CRMS
DROP POLICY IF EXISTS "Authenticated users can view crms" ON public.crms;
DROP POLICY IF EXISTS "Authenticated users can insert crms" ON public.crms;
DROP POLICY IF EXISTS "Authenticated users can update crms" ON public.crms;
DROP POLICY IF EXISTS "Authenticated users can delete crms" ON public.crms;

CREATE POLICY "Authorized users can view crms"
  ON public.crms FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert crms"
  ON public.crms FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update crms"
  ON public.crms FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete crms"
  ON public.crms FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

-- TIPOS_CONSULTORIA
DROP POLICY IF EXISTS "Authenticated users can view tipos_consultoria" ON public.tipos_consultoria;
DROP POLICY IF EXISTS "Authenticated users can insert tipos_consultoria" ON public.tipos_consultoria;
DROP POLICY IF EXISTS "Authenticated users can update tipos_consultoria" ON public.tipos_consultoria;
DROP POLICY IF EXISTS "Authenticated users can delete tipos_consultoria" ON public.tipos_consultoria;

CREATE POLICY "Authorized users can view tipos_consultoria"
  ON public.tipos_consultoria FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can insert tipos_consultoria"
  ON public.tipos_consultoria FOR INSERT
  TO authenticated
  WITH CHECK (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can update tipos_consultoria"
  ON public.tipos_consultoria FOR UPDATE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

CREATE POLICY "Authorized users can delete tipos_consultoria"
  ON public.tipos_consultoria FOR DELETE
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));

-- WEBHOOK_LOGS (mantém acesso para service role para webhooks funcionarem)
DROP POLICY IF EXISTS "Authenticated users can view webhook_logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "Authenticated users can insert webhook_logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "Authenticated users can delete webhook_logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "Service role can insert webhook_logs" ON public.webhook_logs;
DROP POLICY IF EXISTS "Service role can update webhook_logs" ON public.webhook_logs;

CREATE POLICY "Authorized users can view webhook_logs"
  ON public.webhook_logs FOR SELECT
  TO authenticated
  USING (public.is_authorized_user(auth.uid()));