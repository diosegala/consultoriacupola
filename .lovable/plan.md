## Objetivo

Uma página de pesquisa conversacional sobre o que os clientes dizem nas reuniões: você pergunta em linguagem natural e a IA responde citando trechos reais das transcrições, complementados pelos resumos, scores e análises já existentes.

## Nova página `/pesquisa-reunioes`

- Item na sidebar ("Pesquisa de Reuniões"), acessível a todos os roles.
- Layout em duas colunas:
  - **Filtros (opcionais)**: cliente, consultor, período (últimos 3/6/12 meses ou intervalo), tipo de reunião. Vazio = busca em tudo que o usuário pode ver.
  - **Chat**: mesmo padrão visual do Oráculo (markdown, streaming, parar, nova conversa).
- Cada resposta mostra abaixo as **fontes usadas**: cards com cliente, data e trecho citado, clicáveis para abrir a reunião.
- Escopo por carteira: diretor/admin pesquisam tudo; consultor pesquisa apenas reuniões dos próprios clientes (validado no servidor, não só na UI).

## Como a busca funciona

1. Indexação: cada transcrição é quebrada em trechos (~1200 caracteres com sobreposição) e recebe um embedding, guardado com `reuniao_id`, `cliente_id`, `consultor_id` e data.
2. Na pergunta: gera-se o embedding da pergunta e buscam-se os trechos mais similares dentro do escopo permitido e dos filtros escolhidos.
3. Contexto agregado: junto aos trechos, envia-se um resumo estruturado das reuniões envolvidas (resumo_ia, score do cliente, dimensões de engajamento, compromissos) para a IA conseguir responder perguntas quantitativas ("quais clientes reclamam de X?", "o engajamento caiu depois de Y?").
4. A IA responde citando cliente e data de cada afirmação, e diz explicitamente quando não há evidência nas transcrições.

## Indexação das reuniões existentes e novas

- Backfill: rotina que indexa as transcrições já existentes em lotes, com botão "Reindexar transcrições" na área administrativa e barra de progresso (X de Y reuniões indexadas).
- Novas reuniões: indexação automática logo após a análise da reunião, e no sync diário do Drive.
- Reindexação incremental: só reprocessa reuniões cuja transcrição mudou ou que ainda não têm trechos.

## Detalhes técnicos

- Nova tabela `reunioes_chunks` (`reuniao_id`, `cliente_id`, `consultor_id`, `data_reuniao`, `chunk_index`, `conteudo`, `embedding vector(1536)`, `hash_transcricao`) com índice HNSW, GRANTs e RLS espelhando as policies de `reunioes` (admin/diretor tudo, consultor só a própria carteira).
- Função SQL `buscar_trechos_reunioes(query_embedding, filtros, match_count)` em SECURITY INVOKER, para que o RLS aplique o escopo automaticamente.
- Edge function `indexar-reunioes`: chunking + embeddings via `openai/text-embedding-3-small` (mesmo modelo já usado no Oráculo, mantendo compatibilidade), processamento em lotes com retomada.
- Edge function `pesquisa-reunioes`: valida Authorization antes do body, gera embedding da pergunta, busca trechos com o cliente do usuário (RLS ativo), monta o contexto agregado e faz streaming SSE com Claude (mesmo padrão do `oraculo-chat`), registrando uso em `ai_usage_logs`.
- Histórico das conversas reaproveita `oraculo_conversas`/`oraculo_mensagens` com um marcador de origem, evitando tabelas duplicadas.
- Frontend: hook `usePesquisaReunioes` (streaming + fontes) e página nova reutilizando o padrão do `OraculoChatPanel`.

## Custo e limites

A indexação inicial gera embeddings de todas as transcrições uma única vez (custo baixo, por token); depois só as reuniões novas. As respostas usam apenas os trechos mais relevantes, mantendo cada pergunta barata.
