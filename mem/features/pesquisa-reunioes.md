---
name: Pesquisa de Reuniões
description: Chat com busca semântica nas transcrições de reuniões, com escopo por carteira e fontes citadas
type: feature
---
Página `/pesquisa-reunioes` (todos os roles). Pergunta em linguagem natural → busca semântica em `reunioes_chunks` (chunks de ~1200 chars, embeddings `openai/text-embedding-3-small` 1536d) + panorama agregado (resumo_ia, score_cliente, análise, compromissos) → resposta Claude citando (Cliente — data) e cards de fontes.

- Escopo: RLS na tabela e RPC `buscar_trechos_reunioes` em SECURITY INVOKER (admin/diretor tudo; consultor só a própria carteira).
- Filtros opcionais: cliente, consultor, período.
- Indexação: edge function `indexar-reunioes` (backfill em lotes com botão para admin/diretor, dedupe por hash da transcrição) + chamada automática ao fim de `analisar-reuniao`.
- Histórico reaproveita `oraculo_conversas`/`oraculo_mensagens` com `contexto_origem.tipo = "pesquisa_reunioes"`.