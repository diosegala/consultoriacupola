-- 1) Add status_cliente column to projetos_etapas (nullable, references existing status enum)
ALTER TABLE public.projetos_etapas
  ADD COLUMN IF NOT EXISTS status_cliente public.status_cliente;

COMMENT ON COLUMN public.projetos_etapas.status_cliente IS
  'Status do cliente sincronizado automaticamente quando um projeto entra nesta etapa.';

-- 2) Defaults razoáveis baseados nos nomes das etapas atuais.
--    Admin pode reconfigurar via Configurações > Etapas do Kanban.
UPDATE public.projetos_etapas SET status_cliente = 'novo'
  WHERE status_cliente IS NULL AND nome IN ('Pré-Onboarding', 'Onboarding');

UPDATE public.projetos_etapas SET status_cliente = 'ativo'
  WHERE status_cliente IS NULL AND nome IN (
    'Elaboração do Diagnóstico',
    'Apresentação do Diagnóstico',
    'Primeiro Cliente Oculto',
    'Elaboração de OKRs',
    'Reuniões de Acompanhamento',
    'Renovação Fechada'
  );

UPDATE public.projetos_etapas SET status_cliente = 'aguardando_renovacao'
  WHERE status_cliente IS NULL AND nome IN (
    'Ciclo de Renovação',
    'Negociação de Renovação'
  );