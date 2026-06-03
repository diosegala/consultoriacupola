
-- 1. Adicionar colunas
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS data_fim_pagamento DATE,
  ADD COLUMN IF NOT EXISTS encerrado_em TIMESTAMPTZ;

-- 2. Backfill data_fim_pagamento para todos os contratos existentes
-- antecipado: última parcela = data_inicio + (parcelas - 1) meses
-- postecipado: última parcela = data_inicio + parcelas meses
UPDATE public.contratos
SET data_fim_pagamento = (
  data_inicio + (
    CASE WHEN tipo_vencimento = 'antecipado'
      THEN GREATEST(parcelas - 1, 0)
      ELSE parcelas
    END
  ) * INTERVAL '1 month'
)::date
WHERE data_fim_pagamento IS NULL;

-- 3. Função para aplicar baixa em contratos cujo pagamento terminou
CREATE OR REPLACE FUNCTION public.aplicar_baixa_contratos_pagos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato RECORD;
  v_outros_ativos INT;
BEGIN
  FOR v_contrato IN
    SELECT id, cliente_id
    FROM public.contratos
    WHERE ativo = true
      AND encerrado_em IS NOT NULL
      AND data_fim_pagamento IS NOT NULL
      AND data_fim_pagamento < CURRENT_DATE
  LOOP
    UPDATE public.contratos
    SET ativo = false
    WHERE id = v_contrato.id;

    SELECT COUNT(*) INTO v_outros_ativos
    FROM public.contratos
    WHERE cliente_id = v_contrato.cliente_id
      AND ativo = true
      AND id <> v_contrato.id;

    IF v_outros_ativos = 0 THEN
      UPDATE public.clientes
      SET status = 'encerrado'
      WHERE id = v_contrato.cliente_id;
    END IF;
  END LOOP;
END;
$$;
