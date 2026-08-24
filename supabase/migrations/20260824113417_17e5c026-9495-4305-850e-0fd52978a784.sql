-- 1) Limpeza dos duplicados: mantém a linha com log de importação (ou a mais antiga)
WITH ranked AS (
  SELECT r.id,
         row_number() OVER (
           PARTITION BY r.cliente_id, r.data_reuniao, md5(coalesce(r.transcricao, ''))
           ORDER BY (EXISTS (SELECT 1 FROM public.reunioes_importadas_log l WHERE l.reuniao_id = r.id)) DESC,
                    (r.status_analise = 'concluido') DESC,
                    r.created_at ASC
         ) AS rn
  FROM public.reunioes r
  WHERE r.transcricao IS NOT NULL
),
dups AS (SELECT id FROM ranked WHERE rn > 1)
DELETE FROM public.reunioes WHERE id IN (SELECT id FROM dups);

-- 2) Trava no banco contra transcrições idênticas para o mesmo cliente/data
CREATE UNIQUE INDEX IF NOT EXISTS reunioes_dedupe_uidx
  ON public.reunioes (cliente_id, data_reuniao, md5(transcricao))
  WHERE transcricao IS NOT NULL;