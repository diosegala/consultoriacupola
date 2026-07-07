
ALTER TABLE public.reunioes_gestao
  DROP CONSTRAINT IF EXISTS reunioes_gestao_tipo_check;

ALTER TABLE public.reunioes_gestao
  ADD CONSTRAINT reunioes_gestao_tipo_check
  CHECK (tipo IN ('individual', '1on1', 'weekly', 'equipe'));

UPDATE public.reunioes_gestao
   SET tipo = 'weekly'
 WHERE tipo IN ('individual', '1on1')
   AND lower(coalesce(nome_arquivo, '')) LIKE '%weekly%';

UPDATE public.reunioes_gestao
   SET tipo = '1on1'
 WHERE tipo = 'individual';
