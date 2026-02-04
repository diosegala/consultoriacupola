-- Criar tabela para registrar viagens/despesas por contrato
CREATE TABLE public.viagens_contrato (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data_viagem DATE NOT NULL,
  descricao TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.viagens_contrato ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view viagens_contrato"
ON public.viagens_contrato
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert viagens_contrato"
ON public.viagens_contrato
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update viagens_contrato"
ON public.viagens_contrato
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete viagens_contrato"
ON public.viagens_contrato
FOR DELETE
TO authenticated
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_viagens_contrato_updated_at
BEFORE UPDATE ON public.viagens_contrato
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();