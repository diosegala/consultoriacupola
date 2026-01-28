

# Plano de Correção: Atualizar Datas dos Contratos

## Problema Identificado

As datas de início e fim dos contratos foram importadas incorretamente. A edge function usou datas genéricas ao invés das datas exatas da planilha.

### Exemplos de Erros

| Cliente | Data Fim na Planilha | Data Fim no Banco | Status |
|---------|---------------------|-------------------|--------|
| Agulha no Celeiro | 25/10/2025 | 2026-02-01 | ❌ Errado |
| Lobato Machado | 20/02/2025 | 2026-01-01 | ❌ Errado |
| Redeplan | 28/02/2026 | 2026-02-01 | ❌ Errado |
| Abias | 24/06/2026 | 2026-01-01 | ❌ Errado |
| Blue House | 01/06/2026 | 2025-09-01 | ❌ Errado |
| Bortolini | 05/07/2026 | 2026-02-01 | ❌ Errado |
| Zireh | 13/03/2026 | 2025-08-01 | ❌ Errado |

---

## Solução

Executar um script SQL para atualizar todas as datas de contratos com os valores corretos extraídos diretamente da planilha.

### Dados Corretos a Aplicar

Com base na planilha, as datas corretas são:

| Cliente | Data Início | Data Fim | Prazo |
|---------|-------------|----------|-------|
| Bertoni | 2025-01-21 | 2026-01-21 | 12 |
| Agulha no Celeiro | 2025-02-26 | 2025-10-25 | 7 |
| Lobato Machado | 2024-02-20 | 2025-02-20 | 12 |
| Redeplan | 2026-01-14 | 2026-02-28 | 1.5 |
| Abias | 2025-06-24 | 2026-06-24 | 12 |
| Blue House | 2026-01-12 | 2026-06-01 | 4 |
| Bortolini | 2026-01-06 | 2026-07-05 | 6 |
| AMO Imóveis | 2020-10-13 | 2026-01-01 | 12 |
| Exo Investimento | 2025-09-15 | 2026-10-05 | 12 |
| Campos Incorporadora | 2025-09-10 | 2026-03-10 | 6 |
| Citas | 2025-05-12 | 2026-05-12 | 12 |
| Copa Azul | 2025-11-03 | 2025-03-03 (erro na planilha?) | 4 |
| Jair Amintas | 2025-07-24 | 2026-07-24 | 12 |
| Zireh | 2025-08-21 | 2026-03-13 | 6 |
| Helmer | 2024-08-15 | 2026-10-21 | 12 |
| JBem | 2022-09-22 | 2025-04-04 | 12 |
| E demais clientes... |

---

## Implementação

### Etapa 1: Script SQL de Correção

Executar UPDATE para cada contrato com as datas exatas da planilha:

```sql
UPDATE contratos SET 
  data_inicio = 'data_correta',
  data_fim = 'data_correta',
  prazo_meses = valor_correto
WHERE cliente_id = (SELECT id FROM clientes WHERE nome = 'NomeCliente');
```

### Etapa 2: Validação

Após a correção, verificar:
- Alertas de "contratos vencendo" exibem apenas os que realmente vencem nos próximos 30 dias
- Gráfico de MRR histórico calcula corretamente

---

## Resultado Esperado

- Dashboard sem alertas falsos de contratos vencendo
- Datas de renovação precisas para planejamento
- Histórico de MRR calculado corretamente

