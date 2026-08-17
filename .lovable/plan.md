# Acelerar a página de Reuniões

## O problema (confirmado no banco)
Existem 374 reuniões, e as transcrições somam **23 MB** de texto. A página hoje faz `select *`, ou seja, baixa os 23 MB de transcrição inteiros só para montar uma tabela que mostra data, cliente, score e status. É isso que trava o carregamento — não o número de linhas.

## O que muda

### 1. Carregar só o que a tabela precisa
A listagem passa a buscar apenas as colunas exibidas (data, duração, score, status, cliente, consultor). A transcrição e a análise completa deixam de vir na listagem.

Efeito esperado: payload cai de ~23 MB para algumas dezenas de KB.

### 2. Transcrição/análise só ao abrir o detalhe
Ao clicar no olho, o modal busca a reunião completa (transcrição + análise + análise do cliente) por id. Uma requisição pequena, só quando o usuário realmente quer ver.

### 3. Paginação
A tabela passa a carregar 50 reuniões por vez, com botão "Carregar mais" (ordem por data, mais recentes primeiro). Isso também remove o risco do limite silencioso de 1000 linhas do Supabase.

### 4. KPIs vindos do servidor
Os cards Total / Analisadas / Pendentes deixam de ser contados no array carregado e passam a usar contagens `count` no banco (sem trazer linhas), então continuam corretos mesmo com paginação.

### 5. Sincronização em paralelo, sem bloquear
- A lista aparece assim que as reuniões já analisadas chegam; o cálculo de origem (Google Drive x Manual) deixa de ser bloqueante.
- O botão "Analisar pendentes" passa a rodar em fila com concorrência limitada (3 por vez, hoje é uma a uma em série), com barra de progresso e atualização incremental das linhas conforme cada análise termina — sem recarregar a lista inteira.

## Detalhes técnicos
- `src/hooks/useReunioes.ts`:
  - novo tipo "resumo" e select explícito de colunas em `useAllReunioes`, `useReunioesByConsultor`, `useReunioesByCliente` (sem `transcricao`, `analise_ia`, `analise_cliente`, `resumo_ia`).
  - `useAllReunioes` vira `useInfiniteQuery` com `range()` de 50; filtro de origem aplicado via `reunioes_importadas_log` carregado uma vez (só a coluna `reuniao_id`) e cacheado em query própria.
  - novo `useReuniaoDetalhe(id)` para o modal (busca completa por id, `enabled` só quando aberto).
  - novo `useReunioesStats()` usando `select('id', { count: 'exact', head: true })` para os três KPIs.
- `src/components/consultor/ReuniaoAnalise.tsx`: recebe `reuniaoId`, usa `useReuniaoDetalhe`, exibe skeleton enquanto carrega.
- `src/components/consultor/ReunioesList.tsx`: aceita props opcionais `hasMore`/`onLoadMore` para o botão "Carregar mais".
- `src/pages/Reunioes.tsx`: consome a infinite query, KPIs do servidor, fila de análise com concorrência 3 e progresso.
- `ConsultorDetalhe.tsx`, `ReunioesClienteTab.tsx` e `ProjetoDetalheSheet.tsx` seguem funcionando com o select enxuto (nenhum deles usa transcrição na lista).

Sem mudanças de banco, RLS ou edge functions.
