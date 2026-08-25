---
name: Inteligência segmentada por operação
description: Análises de dores/demandas/resistências e oportunidades classificadas em vendas, aluguel (locação) e ambas (transversal)
type: feature
---
Imobiliárias têm duas operações distintas: VENDAS (captação, corretores, funil comercial, VGV) e LOCAÇÃO/ALUGUEL (carteira, contratos, inadimplência, garantias, vistorias).

- `analisar-padroes-clientes` retorna `operacao` ("vendas" | "aluguel" | "ambas") em cada dor, demanda e resistência, além de `resumo_executivo` por operação e `impacto` nas dores.
- `analisar-perfil-clientes` retorna `operacao` em cada oportunidade de produto.
- Página `/inteligencia`: sub-abas Vendas / Locação / Transversal / Visão geral, cards de contagem por operação, gráfico de barras horizontal (recharts) das dores e barras de progresso de frequência. Exportação para Google Docs agrupa o conteúdo por operação.
- Insights antigos sem `operacao` caem como "ambas".
