-- Criar tabela de pausas de contratos
CREATE TABLE public.pausas_contrato (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  motivo TEXT,
  dias_pausados INTEGER,
  prorrogacao_aplicada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pausas_contrato ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view pausas_contrato"
ON public.pausas_contrato
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert pausas_contrato"
ON public.pausas_contrato
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update pausas_contrato"
ON public.pausas_contrato
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete pausas_contrato"
ON public.pausas_contrato
FOR DELETE
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_pausas_contrato_updated_at
BEFORE UPDATE ON public.pausas_contrato
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add campo para indicar se contrato está pausado (campo calculado seria melhor mas vamos simplificar)
ALTER TABLE public.contratos ADD COLUMN pausado BOOLEAN NOT NULL DEFAULT false;